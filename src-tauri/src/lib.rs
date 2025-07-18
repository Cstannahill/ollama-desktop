use futures_util::StreamExt;
use tauri::Emitter;
use audit_log::{record, LogEntry};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

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

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Attachment {
    pub name: String,
    pub mime: String,
    pub status: String, // "processing" | "ready" | "error"
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAttachment {
    pub id: String,
    pub name: String,
    pub path: String,
    pub mime: String,
    pub size: u64,
    pub uploaded_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub attachments: Vec<ProjectAttachment>,
    pub chat_ids: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Message {
    pub id: String,
    pub role: String, // "user" | "assistant" | "tool"
    pub text: String,
    pub name: Option<String>,
    pub attachments: Option<Vec<Attachment>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Chat {
    pub id: String,
    pub title: String,
    pub thread_id: String,
    pub messages: Vec<Message>,
    pub project_id: Option<String>, // Optional project association
    pub created_at: String,
    pub updated_at: String,
}

fn get_chats_dir() -> Result<PathBuf, String> {
    let home_dir = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory")?;
    
    let app_data_dir = PathBuf::from(home_dir)
        .join(".local")
        .join("share")
        .join("ollama-desktop");
    
    let chats_dir = app_data_dir.join("chats");
    if !chats_dir.exists() {
        fs::create_dir_all(&chats_dir).map_err(|e| format!("Failed to create chats directory: {}", e))?;
    }
    Ok(chats_dir)
}

fn get_projects_dir() -> Result<PathBuf, String> {
    let home_dir = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory")?;
    
    let app_data_dir = PathBuf::from(home_dir)
        .join(".local")
        .join("share")
        .join("ollama-desktop");
    
    let projects_dir = app_data_dir.join("projects");
    if !projects_dir.exists() {
        fs::create_dir_all(&projects_dir).map_err(|e| format!("Failed to create projects directory: {}", e))?;
    }
    Ok(projects_dir)
}

fn get_project_files_dir() -> Result<PathBuf, String> {
    let home_dir = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory")?;
    
    let app_data_dir = PathBuf::from(home_dir)
        .join(".local")
        .join("share")
        .join("ollama-desktop");
    
    let files_dir = app_data_dir.join("project_files");
    if !files_dir.exists() {
        fs::create_dir_all(&files_dir).map_err(|e| format!("Failed to create project files directory: {}", e))?;
    }
    Ok(files_dir)
}

#[tauri::command]
async fn save_chat(chat: Chat) -> Result<(), String> {
    let chats_dir = get_chats_dir()?;
    let chat_file = chats_dir.join(format!("{}.json", chat.id));
    
    let chat_json = serde_json::to_string_pretty(&chat)
        .map_err(|e| format!("Failed to serialize chat: {}", e))?;
    
    fs::write(chat_file, chat_json)
        .map_err(|e| format!("Failed to save chat: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn load_chats() -> Result<Vec<Chat>, String> {
    let chats_dir = get_chats_dir()?;
    let mut chats = Vec::new();
    
    let entries = fs::read_dir(chats_dir)
        .map_err(|e| format!("Failed to read chats directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read chat file: {}", e))?;
            
            match serde_json::from_str::<Chat>(&content) {
                Ok(chat) => chats.push(chat),
                Err(e) => eprintln!("Failed to parse chat file {:?}: {}", path, e),
            }
        }
    }
    
    // Sort by updated_at descending (most recent first)
    chats.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    
    Ok(chats)
}

#[tauri::command]
async fn delete_chat(chat_id: String) -> Result<(), String> {
    let chats_dir = get_chats_dir()?;
    let chat_file = chats_dir.join(format!("{}.json", chat_id));
    
    if chat_file.exists() {
        fs::remove_file(chat_file)
            .map_err(|e| format!("Failed to delete chat: {}", e))?;
    }
    
    Ok(())
}

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
    println!("🚀 generate_chat called with:");
    println!("  model: {}", model);
    println!("  prompt: {}", prompt);
    println!("  rag_enabled: {}", rag_enabled);
    println!("  enabled_tools: {:?}", enabled_tools);
    println!("  allowed_tools: {:?}", allowed_tools);
    println!("  thread_id: {}", thread_id);
    
    let mut system_prompt = String::new();
    {
        let map = tool::registry().read().unwrap();
        system_prompt.push_str("| tool | description |\n| --- | --- |\n");
        for t in enabled_tools.iter().filter_map(|n| map.get(n.as_str())) {
            system_prompt.push_str(&format!("| {} | {} |\n", t.name(), t.description()));
        }
    }
    system_prompt.push_str("The workspace directory is a sandbox. Use file_write only for plain-text.\nNEVER overwrite binary files.\n");
    
    println!("📋 System prompt built: {} chars", system_prompt.len());
    
    if rag_enabled {
        println!("🔍 RAG enabled, querying...");
        match rag::query(&prompt, 4).await {
            Ok(ctx) => {
                if !ctx.is_empty() {
                    println!("📚 RAG context found: {} entries", ctx.len());
                    system_prompt.push_str(&format!(
                        "Use the following context to answer the user:\n{}",
                        ctx.join("\n---\n")
                    ));
                } else {
                    println!("📭 RAG query returned empty context");
                }
            }
            Err(e) => {
                println!("❌ RAG query failed: {}. Continuing without RAG context.", e);
                // Continue execution without RAG - this is not a fatal error
            }
        }
    }

    let reg = tool::registry();

    // Remove permission check since we're passing the same tools for both enabled and allowed
    // for t in &enabled_tools {
    //     if !allowed_tools.contains(t) {
    //         return Err(serde_json::json!({"code":"NeedPermission","tool": t}).to_string());
    //     }
    // }

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

    println!("🔧 Tool specs prepared: {} tools", tool_specs.len());
    for (i, tool) in tool_specs.iter().enumerate() {
        if let Some(name) = tool.get("function").and_then(|f| f.get("name")) {
            println!("  {}: {}", i + 1, name);
        }
    }

    let client = reqwest::Client::new();
    let mut messages = Vec::new();
    if !system_prompt.is_empty() {
        messages.push(serde_json::json!({"role": "system", "content": system_prompt}));
    }
    messages.push(serde_json::json!({"role": "user", "content": prompt}));

    println!("📨 Starting conversation loop with {} messages", messages.len());

    loop {
        println!("🔄 Making API call to Ollama...");
        let request_body = if tool_specs.is_empty() {
            serde_json::json!({
                "model": model,
                "stream": true,
                "messages": messages,
            })
        } else {
            serde_json::json!({
                "model": model,
                "stream": true,
                "messages": messages,
                "tools": tool_specs,
            })
        };
        println!("📤 Request body: {}", serde_json::to_string_pretty(&request_body).unwrap_or_else(|_| "Failed to serialize".to_string()));
        
        let res = client
            .post("http://127.0.0.1:11434/api/chat")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| {
                println!("❌ Failed to connect to Ollama: {}", e);
                format!("failed to connect to Ollama: {e}")
            })?;

        println!("✅ Ollama responded with status: {}", res.status());
        
        // Check for HTTP error status codes
        if !res.status().is_success() {
            let status = res.status();
            let error_text = res.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            println!("❌ Ollama API error ({}): {}", status, error_text);
            return Err(format!("Ollama API error ({}): {}", status, error_text));
        }
        
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
async fn save_project(project: Project) -> Result<(), String> {
    let projects_dir = get_projects_dir()?;
    let project_file = projects_dir.join(format!("{}.json", project.id));
    
    let project_json = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;
    
    fs::write(project_file, project_json)
        .map_err(|e| format!("Failed to save project: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn load_projects() -> Result<Vec<Project>, String> {
    let projects_dir = get_projects_dir()?;
    let mut projects = Vec::new();
    
    let entries = fs::read_dir(projects_dir)
        .map_err(|e| format!("Failed to read projects directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read project file: {}", e))?;
            
            match serde_json::from_str::<Project>(&content) {
                Ok(project) => projects.push(project),
                Err(e) => eprintln!("Failed to parse project file {:?}: {}", path, e),
            }
        }
    }
    
    // Sort by created_at descending
    projects.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(projects)
}

#[tauri::command]
async fn delete_project(project_id: String) -> Result<(), String> {
    let projects_dir = get_projects_dir()?;
    let project_file = projects_dir.join(format!("{}.json", project_id));
    
    if project_file.exists() {
        fs::remove_file(project_file)
            .map_err(|e| format!("Failed to delete project: {}", e))?;
    }
    
    // TODO: Also clean up project files and update associated chats
    Ok(())
}

#[tauri::command]
async fn attach_file_to_project(window: tauri::Window, project_id: String, file_path: String) -> Result<ProjectAttachment, String> {
    use std::time::SystemTime;
    use uuid::Uuid;
    
    let source_path = PathBuf::from(&file_path);
    if !source_path.exists() {
        return Err("File does not exist".to_string());
    }
    
    let file_name = source_path.file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid file name")?;
    
    let file_size = source_path.metadata()
        .map_err(|e| format!("Failed to get file metadata: {}", e))?
        .len();
    
    // Create unique file ID and copy to project files directory
    let attachment_id = Uuid::new_v4().to_string();
    let files_dir = get_project_files_dir()?;
    let dest_path = files_dir.join(format!("{}_{}", attachment_id, file_name));
    
    fs::copy(&source_path, &dest_path)
        .map_err(|e| format!("Failed to copy file: {}", e))?;
    
    // Try to determine MIME type (basic implementation)
    let mime_type = match source_path.extension().and_then(|ext| ext.to_str()) {
        Some("txt") | Some("md") => "text/plain",
        Some("pdf") => "application/pdf",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("js") | Some("ts") => "text/javascript",
        Some("json") => "application/json",
        Some("html") => "text/html",
        Some("css") => "text/css",
        _ => "application/octet-stream",
    };
    
    let attachment = ProjectAttachment {
        id: attachment_id,
        name: file_name.to_string(),
        path: dest_path.to_string_lossy().to_string(),
        mime: mime_type.to_string(),
        size: file_size,
        uploaded_at: chrono::Utc::now().to_rfc3339(),
    };
    
    // Emit progress event
    let _ = window.emit(
        "project-file-attached",
        serde_json::json!({
            "projectId": project_id,
            "attachment": attachment
        }),
    );
    
    Ok(attachment)
}

#[tauri::command]
async fn remove_file_from_project(project_id: String, attachment_id: String) -> Result<(), String> {
    // Load project to get file path
    let projects_dir = get_projects_dir()?;
    let project_file = projects_dir.join(format!("{}.json", project_id));
    
    if !project_file.exists() {
        return Err("Project not found".to_string());
    }
    
    let content = fs::read_to_string(&project_file)
        .map_err(|e| format!("Failed to read project: {}", e))?;
    
    let project: Project = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse project: {}", e))?;
    
    // Find the attachment to get its file path
    if let Some(attachment) = project.attachments.iter().find(|a| a.id == attachment_id) {
        let file_path = PathBuf::from(&attachment.path);
        if file_path.exists() {
            fs::remove_file(file_path)
                .map_err(|e| format!("Failed to delete file: {}", e))?;
        }
    }
    
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
// TODO: mobile build targets
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            list_models,
            list_tools,
            generate_chat,
            attach_file,
            save_chat,
            load_chats,
            delete_chat,
            save_project,
            load_projects,
            delete_project,
            attach_file_to_project,
            remove_file_from_project,
            audit_log::get_audit_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
