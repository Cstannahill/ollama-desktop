use futures_util::StreamExt;
use tauri::Emitter;
use audit_log::{record, LogEntry};
use chrono::Utc;
use zip::{ZipWriter, write::FileOptions};
use walkdir::WalkDir;
use std::io::Write;
use tauri_plugin_notification;

mod chunk;
mod config;
mod embeddings;
mod file_ingest;
mod file_tools;
mod shell_exec;
mod audit_log;
mod ollama_client;
mod rag;
mod tool;
mod vector_db;
mod web_search;
mod db;

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
    thread_id: String,
) -> Result<(), String> {
    let mut system_prompt = String::new();
    let id = thread_id
        .parse()
        .map_err(|e| format!("invalid thread id: {e}"))?;
    {
        let map = tool::registry().read().unwrap();
        system_prompt.push_str("| tool | description |\n| --- | --- |\n");
        for t in enabled_tools.iter().filter_map(|n| map.get(n.as_str())) {
            system_prompt.push_str(&format!("| {} | {} |\n", t.name(), t.description()));
        }
    }
    system_prompt.push_str("The workspace directory is a sandbox. Use file_write only for plain-text.\nNEVER overwrite binary files.\n");
    if rag_enabled {
        let (top_k, ctx_tok) = db::get_thread_settings(&thread_id).await.unwrap_or((4,1024));
        if let Ok(ctx) = rag::retrieve_context(&prompt, &id, top_k, ctx_tok as usize).await {
            if !ctx.is_empty() {
                system_prompt.push_str(&ctx);
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
        let mut req = client
            .post(format!("{}/api/chat", ollama_client::base_url()))
            .json(&serde_json::json!({
                "model": model,
                "stream": true,
                "messages": messages,
                "tools": tool_specs,
            }));
        if let Some(t) = ollama_client::bearer_token() {
            req = req.bearer_auth(t);
        }
        let res = req
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
                match tool.call(&window, args.clone()).await {
                    Ok(r) => {
                        record(LogEntry { when: Utc::now(), thread_id: thread_id.clone(), tool: name.clone(), args: args.clone(), ok: true });
                        r
                    },
                    Err(e) => {
                        record(LogEntry { when: Utc::now(), thread_id: thread_id.clone(), tool: name.clone(), args: args.clone(), ok: false });
                        format!("⚠️ {}", e)
                    }
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

#[tauri::command]
async fn set_vector_weight(vector_id: String, weight: f32) -> Result<(), String> {
    vector_db::set_weight(&vector_id, weight)
        .await
        .map_err(|e| e.to_string())?;
    db::update_weight(&vector_id, weight)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn update_thread_settings(thread_id: String, top_k: u8, ctx_tokens: u16) -> Result<(), String> {
    db::set_thread_settings(&thread_id, top_k, ctx_tokens)
        .await
        .map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
struct MtlsPaths { cert: String, key: String, ca: Option<String> }

#[tauri::command]
fn set_server_settings(host: String, port: u16, token: Option<String>, mtls: Option<MtlsPaths>) -> Result<(), String> {
    if host.starts_with("http://") && !(host.contains("127.0.0.1") || host.contains("localhost")) {
        return Err("HTTPS required for remote hosts".into());
    }
    let m = mtls.map(|m| ollama_client::MtlsConfig { cert: m.cert, key: m.key, ca: m.ca });
    ollama_client::set_server(host, port, token, m);
    Ok(())
}

#[tauri::command]
fn export_workspace(thread_id: String) -> Result<String, String> {
    let out = std::env::temp_dir().join(format!("workspace_{thread_id}.zip"));
    let file = std::fs::File::create(&out).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);
    let opts = FileOptions::default();

    let db_path = format!("{}/chat.sqlite", crate::config::WORKSPACE_DIR);
    if std::path::Path::new(&db_path).exists() {
        zip.start_file("chat.sqlite", opts).map_err(|e| e.to_string())?;
        zip.write_all(&std::fs::read(&db_path).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    }

    let dir = std::path::Path::new(crate::config::WORKSPACE_DIR).join(&thread_id);
    if dir.exists() {
        for e in WalkDir::new(&dir) {
            let e = e.map_err(|e| e.to_string())?;
            if e.file_type().is_file() {
                let rel = e.path().strip_prefix(crate::config::WORKSPACE_DIR).unwrap();
                zip.start_file(rel.to_string_lossy(), opts).map_err(|e| e.to_string())?;
                zip.write_all(&std::fs::read(e.path()).map_err(|er| er.to_string())?)
                    .map_err(|er| er.to_string())?;
            }
        }
    }

    let log = serde_json::to_vec(&audit_log::get_audit_log(thread_id)).map_err(|e| e.to_string())?;
    zip.start_file("audit_log.json", opts).map_err(|e| e.to_string())?;
    zip.write_all(&log).map_err(|e| e.to_string())?;

    zip.finish().map_err(|e| e.to_string())?;
    Ok(out.to_string_lossy().to_string())
}

#[tauri::command]
fn import_workspace(zip_path: String) -> Result<(), String> {
    let file = std::fs::File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    for i in 0..zip.len() {
        let mut f = zip.by_index(i).map_err(|e| e.to_string())?;
        let out = std::path::Path::new(crate::config::WORKSPACE_DIR).join(f.name());
        if f.name().ends_with('/') {
            std::fs::create_dir_all(&out).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(p) = out.parent() { std::fs::create_dir_all(p).ok(); }
        let mut o = std::fs::File::create(&out).map_err(|e| e.to_string())?;
        std::io::copy(&mut f, &mut o).map_err(|e| e.to_string())?;
    }
    let log_path = std::path::Path::new(crate::config::WORKSPACE_DIR).join("audit_log.json");
    if log_path.exists() {
        if let Ok(d) = std::fs::read(&log_path) {
            if let Ok(entries) = serde_json::from_slice::<Vec<audit_log::LogEntry>>(&d) {
                for e in entries { audit_log::record(e); }
            }
        }
        let _ = std::fs::remove_file(log_path);
    }
    Ok(())
}

#[tauri::command]
fn save_cloud_credentials(token: Option<String>, cert: Option<String>, key: Option<String>, ca: Option<String>) -> Result<(), String> {
    let service = "ollama_chat.cloud_credentials";
    let kc = tauri::api::keychain::Keychain::new(service, "default");
    let data = serde_json::json!({"token": token, "cert": cert, "key": key, "ca": ca});
    kc.set_password(&data.to_string()).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_cloud_credentials() -> Result<Option<serde_json::Value>, String> {
    let service = "ollama_chat.cloud_credentials";
    let kc = tauri::api::keychain::Keychain::new(service, "default");
    match kc.get_password() {
        Ok(p) => Ok(serde_json::from_str(&p).ok()),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
async fn poll_notifications(since: i64) -> Result<serde_json::Value, String> {
    ollama_client::poll_notifications(since).await.map_err(|e| e.to_string())
}

#[tauri::command]
fn save_device_token(token: String) -> Result<(), String> {
    let kc = tauri::api::keychain::Keychain::new("ollama_chat.cloud_credentials", "device");
    kc.set_password(&token).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
// TODO: mobile build targets
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            list_models,
            list_tools,
            generate_chat,
            attach_file,
            set_vector_weight,
    update_thread_settings,
    set_server_settings,
    save_cloud_credentials,
    load_cloud_credentials,
    poll_notifications,
    save_device_token,
    export_workspace,
    import_workspace,
            audit_log::get_audit_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
