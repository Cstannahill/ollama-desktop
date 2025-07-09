use futures_util::StreamExt;
use tauri::Emitter;

mod ollama_client;
mod rag;
mod embeddings;
mod vector_db;
mod chunk;
mod file_ingest;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn list_models() -> Result<Vec<String>, String> {
    ollama_client::list_models()
        .await
        .map_err(|e| format!("failed to list models: {e}"))
}

#[tauri::command]
async fn generate_chat(
    window: tauri::Window,
    model: String,
    prompt: String,
    rag_enabled: bool,
) -> Result<(), String> {
    let mut system_prompt = None;
    if rag_enabled {
        if let Ok(ctx) = rag::query(&prompt, 4).await {
            if !ctx.is_empty() {
                system_prompt = Some(format!(
                    "Use the following context to answer the user:\n{}",
                    ctx.join("\n---\n")
                ));
            }
        }
    }

    let stream = ollama_client::chat(model, prompt, system_prompt)
        .await
        .map_err(|e| format!("failed to connect to Ollama: {e}"))?;
    tauri::async_runtime::spawn(async move {
        futures_util::pin_mut!(stream);
        while let Some(tok) = stream.next().await {
            let _ = window.emit("chat-token", tok);
        }
        let _ = window.emit("chat-end", ());
    });
    Ok(())
}

#[tauri::command]
async fn attach_file(window: tauri::Window, path: String, thread_id: String) -> Result<(), String> {
    let id = thread_id
        .parse()
        .map_err(|e| format!("invalid thread id: {e}"))?;
    let pb = std::path::PathBuf::from(&path);
    match file_ingest::ingest(pb.clone(), id).await {
        Ok(_) => {
            let _ = window.emit(
                "file-progress",
                serde_json::json!({ "fileName": pb.file_name(), "status": "ready" }),
            );
            Ok(())
        }
        Err(e) => {
            let msg = e.to_string();
            let code = if msg.contains("Unsupported mime") {
                "unsupported_mime"
            } else {
                "ingest_error"
            };
            let _ = window.emit(
                "file-progress",
                serde_json::json!({ "fileName": pb.file_name(), "status": "error", "message": msg }),
            );
            Err(serde_json::json!({"code": code, "message": msg }).to_string())
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, list_models, generate_chat, attach_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
