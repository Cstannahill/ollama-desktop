use anyhow::Context;
use async_trait::async_trait;
use path_clean::PathClean;
use serde_json::Value;
use std::path::{Path, PathBuf};
use tokio::{fs, io::AsyncWriteExt};

fn safe_path(rel: &str) -> anyhow::Result<PathBuf> {
    let p = Path::new(crate::config::WORKSPACE_DIR).join(rel).clean();
    if !p.starts_with(crate::config::WORKSPACE_DIR) {
        anyhow::bail!("Path traversal detected");
    }
    Ok(p)
}

/// FILE READ ───────────────────────────────────────────
pub struct FileReadTool;
#[async_trait]
impl crate::tool::Tool for FileReadTool {
    fn name(&self) -> &'static str {
        "file_read"
    }
    fn description(&self) -> &'static str {
        "Read a UTF-8 text file from the workspace"
    }
    fn json_schema(&self) -> Value {
        json!({
          "type":"object",
          "properties":{ "path": { "type":"string", "description":"Relative path inside workspace" } },
          "required":["path"]
        })
    }
    async fn call(&self, args: Value) -> anyhow::Result<String> {
        let rel = args["path"].as_str().context("missing path")?;
        let abs = safe_path(rel)?;
        let data = fs::read_to_string(&abs)
            .await
            .with_context(|| format!("reading {}", rel))?;
        Ok(if data.len() > 10_000 {
            format!("(truncated) {}", &data[..10_000])
        } else {
            data
        })
    }
}

/// FILE WRITE ──────────────────────────────────────────
pub struct FileWriteTool;
#[async_trait]
impl crate::tool::Tool for FileWriteTool {
    fn name(&self) -> &'static str {
        "file_write"
    }
    fn description(&self) -> &'static str {
        "Write text content to a file in the workspace"
    }
    fn json_schema(&self) -> Value {
        json!({
          "type":"object",
          "properties":{
            "path":  { "type":"string" },
            "content":{ "type":"string" },
            "mode":  { "type":"string", "enum":["overwrite","append"], "default":"overwrite" }
          },
          "required":["path","content"]
        })
    }
    async fn call(&self, args: Value) -> anyhow::Result<String> {
        let rel = args["path"].as_str().context("missing path")?;
        let content = args["content"].as_str().context("missing content")?;
        let mode = args["mode"].as_str().unwrap_or("overwrite");
        let abs = safe_path(rel)?;

        if let Some(parent) = abs.parent() {
            fs::create_dir_all(parent).await.ok();
        }

        let mut f = match mode {
            "append" => {
                fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&abs)
                    .await?
            }
            _ => fs::File::create(&abs).await?,
        };
        f.write_all(content.as_bytes()).await?;
        Ok(format!("Wrote {} bytes to {}", content.len(), rel))
    }
}
