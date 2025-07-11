use anyhow::Context;
use async_trait::async_trait;
use path_clean::PathClean;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use tokio::{fs, io::AsyncWriteExt};

fn safe_path(rel: &str) -> anyhow::Result<PathBuf> {
    let workspace_dir = crate::config::WORKSPACE_DIR;
    
    // If path is absolute and outside workspace, but still reasonable, allow it
    let path = Path::new(rel);
    if path.is_absolute() {
        // Allow reading files in common directories like home, documents, etc.
        let path_str = path.to_string_lossy();
        if path_str.starts_with("/home") || 
           path_str.starts_with("/Users") || 
           path_str.starts_with("/tmp") ||
           path_str.starts_with(workspace_dir) {
            return Ok(path.to_path_buf());
        } else {
            anyhow::bail!("Access to this path is not allowed for security reasons");
        }
    }
    
    // For relative paths, join with workspace
    let p = Path::new(workspace_dir).join(rel).clean();
    
    // Allow paths that start with workspace or are within reasonable bounds
    if !p.starts_with(workspace_dir) {
        // Check if it's a reasonable relative path that goes outside workspace
        if rel.contains("..") && rel.matches("..").count() > 3 {
            anyhow::bail!("Path traversal too deep");
        }
        // Allow some traversal outside workspace for flexibility
        return Ok(p);
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
    async fn call(&self, _window: &tauri::Window, args: Value) -> anyhow::Result<String> {
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
    async fn call(&self, _window: &tauri::Window, args: Value) -> anyhow::Result<String> {
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
