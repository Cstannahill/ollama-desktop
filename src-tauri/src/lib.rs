use futures_util::StreamExt;
use tauri::Emitter;

mod chunk;
mod config;
mod embeddings;
mod file_ingest;
mod file_tools;
mod ollama_client;
mod rag;
mod tool;
mod vector_db;
mod web_search;

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
fn list_tools() -> Vec<tool::ToolMeta> {
    let map = tool::registry().read().unwrap();
    map.values()
        .map(|t| tool::ToolMeta {
            name: t.name(),
            description: t.description(),
            json_schema: t.json_schema(),
        })
        .collect()
}

#[tauri::command]
async fn generate_chat(
    window: tauri::Window,
    model: String,
    prompt: String,
    rag_enabled: bool,
    enabled_tools: Vec<String>,
    allowed_tools: Vec<String>,
    _thread_id: String,
) -> Result<(), String> {
    let mut system_prompt = String::new();
    {
        let map = tool::registry().read().unwrap();
        system_prompt.push_str("| tool | description |\n| --- | --- |\n");
        for t in enabled_tools.iter().filter_map(|n| map.get(n.as_str())) {
            system_prompt.push_str(&format!("| {} | {} |\n", t.name(), t.description()));
        }
    }
    system_prompt.push_str("The workspace directory is a sandbox. Use file_write only for plain-text.\nNEVER overwrite binary files.\n");
    if rag_enabled {
        if let Ok(ctx) = rag::query(&prompt, 4).await {
            if !ctx.is_empty() {
                system_prompt.push_str(&format!(
                    "Use the following context to answer the user:\n{}",
                    ctx.join("\n---\n")
                ));
            }
        }
    }

    let reg = tool::registry();

    for t in &enabled_tools {
        if !allowed_tools.contains(t) {
            return Err(serde_json::json!({"code":"NeedPermission","tool": t}).to_string());
        }
    }

    let tool_specs: Vec<serde_json::Value> = {
        let map = reg.read().unwrap();
        enabled_tools
            .iter()
            .filter_map(|n| map.get(n.as_str()))
            .map(|t| {
                serde_json::json!({
                    "type": "function",
                    "function": {
                        "name": t.name(),
                        "description": t.description(),
                        "parameters": t.json_schema(),
                    }
                })
            })
            .collect()
    };

    let client = reqwest::Client::new();
    let mut messages = Vec::new();
    if !system_prompt.is_empty() {
        messages.push(serde_json::json!({"role": "system", "content": system_prompt}));
    }
    messages.push(serde_json::json!({"role": "user", "content": prompt}));

    loop {
        let res = client
            .post("http://127.0.0.1:11434/api/chat")
            .json(&serde_json::json!({
                "model": model,
                "stream": true,
                "messages": messages,
                "tools": tool_specs,
            }))
            .send()
            .await
            .map_err(|e| format!("failed to connect to Ollama: {e}"))?;

        let mut stream_resp = res.bytes_stream();
        let mut buf = Vec::new();
        let mut call: Option<(String, serde_json::Value)> = None;

        while let Some(chunk) = stream_resp.next().await {
            if let Ok(bytes) = chunk {
                buf.extend_from_slice(&bytes);
                while let Some(pos) = buf.iter().position(|b| *b == b'\n') {
                    let line: Vec<u8> = buf.drain(..=pos).collect();
                    let trimmed = String::from_utf8_lossy(&line).trim().to_string();
                    if trimmed.is_empty() {
                        continue;
                    }
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&trimmed) {
                        if let Some(content) = v["message"]["content"].as_str() {
                            let _ = window.emit("chat-token", content.to_string());
                        }
                        if let Some(tc) = v["message"]["tool_calls"]
                            .as_array()
                            .and_then(|a| a.first())
                        {
                            let name = tc["function"]["name"].as_str().unwrap_or("").to_string();
                            let args_v = &tc["function"]["arguments"];
                            let args = if args_v.is_string() {
                                serde_json::from_str(args_v.as_str().unwrap_or("{}"))
                                    .unwrap_or_default()
                            } else {
                                args_v.clone()
                            };
                            call = Some((name, args));
                        }
                        if v["done"].as_bool() == Some(true) {
                            break;
                        }
                    }
                }
            }
        }

        if let Some((name, args)) = call {
            let tool = {
                let map = reg.read().unwrap();
                map.get(name.as_str()).cloned()
            };
            let result = if let Some(tool) = tool {
                match tool.call(args.clone()).await {
                    Ok(r) => r,
                    Err(e) => format!("⚠️ {}", e),
                }
            } else {
                format!("⚠️ unknown tool: {}", name)
            };
            let _ = window.emit(
                "tool-message",
                serde_json::json!({"name": name, "content": result}),
            );
            messages.push(serde_json::json!({
                "role": "assistant",
                "tool_calls": [{"function": {"name": name, "arguments": args}}],
            }));
            messages.push(serde_json::json!({"role": "tool", "name": name, "content": result}));
            continue;
        } else {
            break;
        }
    }

    let _ = window.emit("chat-end", ());
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
        .invoke_handler(tauri::generate_handler![
            greet,
            list_models,
            list_tools,
            generate_chat,
            attach_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
