use async_trait::async_trait;
use serde_json::{json, Value};
use tokio::{
    io::{AsyncReadExt, BufReader},
    process::Command,
    time::timeout,
};
use anyhow::Context;
use tauri::Emitter;

const CMD_TIMEOUT_SECS: u64 = 5;
const OUTPUT_LIMIT_BYTES: usize = 30 * 1024; // 30 KB
static WHITELIST: &[&str] = &["ls", "cat", "grep", "echo", "pwd", "sed", "awk"];

pub struct ShellExecTool;

#[async_trait]
impl crate::tool::Tool for ShellExecTool {
    fn name(&self) -> &'static str {
        "shell_exec"
    }
    fn description(&self) -> &'static str {
        "Run simple read-only shell commands in the workspace"
    }
    fn json_schema(&self) -> Value {
        json!({
          "type":"object",
          "properties":{
            "cmd":  { "type":"string", "description":"Base command. Must be whitelisted." },
            "args": { "type":"array",  "items":{"type":"string"}, "default":[] }
          },
          "required":["cmd"]
        })
    }

    async fn call(&self, window: &tauri::Window, args: Value) -> anyhow::Result<String> {
        let cmd = args["cmd"].as_str().context("missing cmd")?;
        let arr = args["args"].as_array().cloned().unwrap_or_default();

        if !WHITELIST.contains(&cmd) {
            anyhow::bail!("Command not permitted: {}", cmd);
        }

        let mut child = Command::new(cmd)
            .args(arr.into_iter().filter_map(|v| v.as_str().map(str::to_owned)))
            .current_dir(crate::config::WORKSPACE_DIR)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .context("spawn failed")?;

        let mut out = Vec::new();
        let mut rdr = BufReader::new(child.stdout.take().unwrap());
        let mut err = BufReader::new(child.stderr.take().unwrap());

        // ──────────────────────────────────────────────────────────────
        let join = async {
            let mut out_buf = [0u8; 1024];
            let mut err_buf = [0u8; 1024];
            let mut out_closed = false;
            let mut err_closed = false;

            loop {
                tokio::select! {
                    // ── stdout ───────────────────────────────────────
                    Ok(n) = rdr.read(&mut out_buf), if !out_closed => {
                        if n == 0 {
                            out_closed = true;        // EOF on stdout
                        } else {
                            window
                                .emit("tool-stream", String::from_utf8_lossy(&out_buf[..n]).to_string())
                                .ok();
                            out.extend_from_slice(&out_buf[..n]);
                        }
                    },

                    // ── stderr ───────────────────────────────────────
                    Ok(n) = err.read(&mut err_buf), if !err_closed => {
                        if n == 0 {
                            err_closed = true;        // EOF on stderr
                        } else {
                            window
                                .emit("tool-stream", String::from_utf8_lossy(&err_buf[..n]).to_string())
                                .ok();
                            out.extend_from_slice(&err_buf[..n]);
                        }
                    },
                }

                // Exit when both pipes are closed or we hit the output cap
                if (out_closed && err_closed) || out.len() > OUTPUT_LIMIT_BYTES {
                    break;
                }
            }
            Ok::<(), anyhow::Error>(())
        };
        // ──────────────────────────────────────────────────────────────

        if timeout(std::time::Duration::from_secs(CMD_TIMEOUT_SECS), join)
            .await
            .is_err()
        {
            let _ = child.kill().await;
            anyhow::bail!("Command timed out");
        }

        let text = String::from_utf8_lossy(&out);
        Ok(text.trim().to_string())
    }
}
