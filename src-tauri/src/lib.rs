use futures_util::StreamExt;
use tauri::Emitter;

mod ollama_client;

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
async fn generate_chat(window: tauri::Window, model: String, prompt: String) -> Result<(), String> {
    let stream = ollama_client::chat(model, prompt)
        .await
        .map_err(|e| format!("failed to connect to Ollama: {e}"))?;
    tauri::async_runtime::spawn(async move {
        futures_util::pin_mut!(stream);
        while let Some(tok) = stream.next().await {
            let _ = window.emit("token", tok);
        }
        let _ = window.emit("token_end", ());
    });
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, list_models, generate_chat])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
