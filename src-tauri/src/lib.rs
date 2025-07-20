use futures_util::StreamExt;
use tauri::Emitter;
use audit_log::{record, LogEntry};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

mod chunk;
mod config;
mod context_manager;
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
mod qdrant_service;

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
    
    // PHASE 2: Auto-vectorize conversation messages for semantic search (async, non-blocking)
    let thread_id_clone = chat.thread_id.clone();
    let project_id_clone = chat.project_id.clone();
    let messages_clone = chat.messages.clone();
    
    // Spawn vectorization in background to avoid blocking chat save
    tokio::spawn(async move {
        println!("🔄 Auto-vectorizing {} conversation messages...", messages_clone.len());
        let mut success_count = 0;
        let mut error_count = 0;
        
        for message in &messages_clone {
            match vectorize_conversation_message(
                &thread_id_clone,
                message,
                project_id_clone.as_deref()
            ).await {
                Ok(_) => success_count += 1,
                Err(e) => {
                    error_count += 1;
                    // Only log first few errors to avoid spam
                    if error_count <= 3 {
                        eprintln!("Failed to vectorize message {}: {}", message.id, e);
                        if error_count == 3 {
                            eprintln!("... suppressing further vectorization errors for this chat");
                        }
                    }
                }
            }
        }
        
        if success_count > 0 || error_count > 0 {
            println!("📊 Vectorization complete: {} success, {} errors", success_count, error_count);
        }
    });
    
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

// Helper function to load chat by thread_id for conversation context
async fn load_chat_by_thread_id(thread_id: &str) -> Result<Option<Chat>, String> {
    let chats_dir = get_chats_dir()?;
    
    let entries = fs::read_dir(chats_dir)
        .map_err(|e| format!("Failed to read chats directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read chat file: {}", e))?;
            
            match serde_json::from_str::<Chat>(&content) {
                Ok(chat) => {
                    if chat.thread_id == thread_id {
                        return Ok(Some(chat));
                    }
                },
                Err(e) => eprintln!("Failed to parse chat file {:?}: {}", path, e),
            }
        }
    }
    
    Ok(None)
}

// PHASE 2: Conversation vectorization functions

// Check if Qdrant is available (cached for 30 seconds to avoid repeated checks)
static QDRANT_AVAILABLE: std::sync::OnceLock<std::sync::Arc<tokio::sync::RwLock<(bool, std::time::Instant)>>> = std::sync::OnceLock::new();

async fn is_qdrant_available() -> bool {
    let cache = QDRANT_AVAILABLE.get_or_init(|| {
        std::sync::Arc::new(tokio::sync::RwLock::new((false, std::time::Instant::now())))
    });
    
    let (is_available, last_check) = *cache.read().await;
    
    // Check cache validity (30 seconds)
    if last_check.elapsed().as_secs() < 30 {
        return is_available;
    }
    
    // Test Qdrant connection
    let available = match reqwest::Client::new()
        .get("http://127.0.0.1:6333/")
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
    {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    };
    
    // Update cache
    *cache.write().await = (available, std::time::Instant::now());
    
    if !available {
        println!("⚠️ Qdrant not available at 127.0.0.1:6333 - vectorization disabled");
    }
    
    available
}

// Vectorize a conversation message for semantic search
async fn vectorize_conversation_message(
    thread_id: &str,
    message: &Message,
    project_id: Option<&str>,
) -> anyhow::Result<()> {
    // Skip empty messages, tool messages, and very short messages
    if message.text.trim().is_empty() 
        || message.role == "tool" 
        || message.text.trim().len() < 10 {
        return Ok(());
    }
    
    // Try to ensure Qdrant is running (auto-start if configured)
    if !is_qdrant_available().await {
        println!("🚀 Qdrant not running, attempting auto-start...");
        match qdrant_service::ensure_qdrant_running().await {
            Ok(()) => {
                println!("✅ Qdrant started successfully for vectorization");
                // Wait a moment for service to fully initialize
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            },
            Err(e) => {
                eprintln!("⚠️ Failed to auto-start Qdrant: {}", e);
                return Err(anyhow::anyhow!("Qdrant auto-start failed: {}", e));
            }
        }
    }
    
    // Generate embedding for the message content
    let embedding = embeddings::embed(&message.text).await?;
    
    // Create payload with message metadata
    let payload = serde_json::json!({
        "thread_id": thread_id,
        "message_id": message.id,
        "role": message.role,
        "content": message.text,
        "project_id": project_id,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "type": "conversation"
    });
    
    // Store in conversations collection
    let vector_id = format!("{}_{}", thread_id, message.id);
    vector_db::upsert_to_collection(
        "conversations",
        &vector_id,
        embedding,
        payload
    ).await?;
    
    Ok(())
}

// Vectorize all messages in a chat (for initial processing or catch-up)
async fn vectorize_full_conversation(chat: &Chat) -> anyhow::Result<()> {
    println!("📊 Vectorizing full conversation: {} messages", chat.messages.len());
    
    for message in &chat.messages {
        if let Err(e) = vectorize_conversation_message(
            &chat.thread_id,
            message,
            chat.project_id.as_deref()
        ).await {
            // Log error but continue with other messages
            eprintln!("Failed to vectorize message {}: {}", message.id, e);
        }
    }
    
    Ok(())
}

// Search conversations within a project for relevant context
async fn search_project_conversations(
    query: &str,
    project_id: &str,
    current_thread_id: &str,
    limit: usize,
) -> anyhow::Result<Vec<String>> {
    println!("🔍 Searching conversations in project {} for: {}", project_id, query);
    
    // Generate embedding for the search query
    let query_embedding = embeddings::embed(query).await?;
    
    // Search conversations, excluding current thread
    let filter = format!("project_id = '{}' AND thread_id != '{}'", project_id, current_thread_id);
    let search_results = vector_db::search(
        "conversations",
        query_embedding,
        limit,
        Some(&filter)
    ).await?;
    
    let mut context_results = Vec::new();
    for hit in search_results {
        if let (Some(content), Some(role), Some(thread_id)) = (
            hit.payload.get("content").and_then(|v| v.as_str()),
            hit.payload.get("role").and_then(|v| v.as_str()),
            hit.payload.get("thread_id").and_then(|v| v.as_str())
        ) {
            // Format context with source information
            let context_entry = format!(
                "[Previous conversation in thread {}] {}: {}",
                &thread_id[..8], // Show first 8 chars of thread ID
                role,
                content
            );
            context_results.push(context_entry);
        }
    }
    
    println!("📚 Found {} relevant conversation snippets", context_results.len());
    Ok(context_results)
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
    
    // PHASE 2: Enhanced RAG with conversation search
    if rag_enabled {
        println!("🔍 Enhanced RAG enabled, querying documents and conversations...");
        
        // Get project_id from the current chat for enhanced RAG
        let project_id = match load_chat_by_thread_id(&thread_id).await {
            Ok(Some(chat)) => chat.project_id,
            _ => None
        };
        
        // Use enhanced RAG that searches both documents and conversations
        match rag::enhanced_query(&prompt, project_id.as_deref(), &thread_id, 3, 2).await {
            Ok(ctx) => {
                if !ctx.is_empty() {
                    println!("📚 Enhanced RAG context found: {} entries", ctx.len());
                    system_prompt.push_str(&format!(
                        "\n\nUse the following context to answer the user:\n{}",
                        ctx.join("\n---\n")
                    ));
                } else {
                    println!("📭 Enhanced RAG query returned empty context");
                }
            }
            Err(e) => {
                println!("❌ Enhanced RAG query failed: {}. Falling back to document-only RAG.", e);
                // Fallback to document-only RAG
                match rag::query(&prompt, 4).await {
                    Ok(ctx) => {
                        if !ctx.is_empty() {
                            println!("📚 Fallback RAG context found: {} entries", ctx.len());
                            system_prompt.push_str(&format!(
                                "\n\nUse the following context to answer the user:\n{}",
                                ctx.join("\n---\n")
                            ));
                        }
                    }
                    Err(e2) => {
                        println!("❌ Fallback RAG also failed: {}. Continuing without RAG context.", e2);
                    }
                }
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
    
    // Add system prompt first
    if !system_prompt.is_empty() {
        messages.push(serde_json::json!({"role": "system", "content": system_prompt}));
    }

    // PHASE 3: Smart context management with optimization
    println!("🔍 Loading conversation history for thread_id: {}", thread_id);
    
    let context_manager = context_manager::ContextManager::new(Some(&model));
    let mut conversation_messages = Vec::new();
    
    match load_chat_by_thread_id(&thread_id).await {
        Ok(Some(chat)) => {
            println!("📚 Found existing chat with {} messages", chat.messages.len());
            
            // Filter out tool messages and empty messages
            let filtered_messages: Vec<_> = chat.messages
                .iter()
                .filter(|m| m.role != "tool" && !m.text.trim().is_empty())
                .cloned()
                .collect();
            
            // Check if we need context optimization
            if context_manager.needs_optimization(&filtered_messages, &system_prompt) {
                println!("📊 Context window full, optimizing conversation history...");
                
                match context_manager.optimize_conversation_context(&filtered_messages, &system_prompt).await {
                    Ok(optimized) => {
                        conversation_messages = optimized;
                        println!("✅ Context optimized: {} original → {} optimized messages", 
                                filtered_messages.len(), conversation_messages.len());
                    },
                    Err(e) => {
                        println!("⚠️ Context optimization failed: {}. Using recent messages only.", e);
                        // Fallback: just take the most recent messages
                        for msg in filtered_messages.iter().rev().take(10).rev() {
                            conversation_messages.push(serde_json::json!({
                                "role": msg.role,
                                "content": msg.text
                            }));
                        }
                    }
                }
            } else {
                // Context fits within limits, use all messages
                for msg in &filtered_messages {
                    conversation_messages.push(serde_json::json!({
                        "role": msg.role,
                        "content": msg.text
                    }));
                }
                println!("✅ All {} conversation messages fit within context window", filtered_messages.len());
            }
        },
        Ok(None) => {
            println!("📝 No existing chat found for thread_id, starting fresh conversation");
        },
        Err(e) => {
            println!("⚠️ Failed to load chat history: {}. Continuing without history.", e);
        }
    }
    
    // Add optimized conversation messages
    messages.extend(conversation_messages);
    
    // Add the current user message
    messages.push(serde_json::json!({"role": "user", "content": prompt}));

    println!("📨 Starting conversation loop with {} messages (including history)", messages.len());

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

// PHASE 2: Manual conversation vectorization command for existing chats
#[tauri::command]
async fn vectorize_existing_conversations() -> Result<String, String> {
    println!("🚀 Starting vectorization of all existing conversations...");
    
    // Ensure Qdrant is running before starting vectorization
    if !is_qdrant_available().await {
        println!("🚀 Qdrant not running, attempting auto-start...");
        match qdrant_service::ensure_qdrant_running().await {
            Ok(()) => {
                println!("✅ Qdrant started successfully for batch vectorization");
                // Wait a moment for service to fully initialize
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
            },
            Err(e) => {
                let error_msg = format!("Failed to start Qdrant for vectorization: {}", e);
                eprintln!("⚠️ {}", error_msg);
                return Err(error_msg);
            }
        }
    }
    
    let chats = load_chats().await?;
    let mut processed = 0;
    let mut errors = 0;
    
    for chat in chats {
        println!("📊 Processing chat: {} ({} messages)", chat.title, chat.messages.len());
        
        match vectorize_full_conversation(&chat).await {
            Ok(_) => {
                processed += 1;
                println!("✅ Vectorized chat: {}", chat.title);
            },
            Err(e) => {
                errors += 1;
                eprintln!("❌ Failed to vectorize chat {}: {}", chat.title, e);
            }
        }
    }
    
    let result = format!(
        "Vectorization complete: {} chats processed, {} errors",
        processed, errors
    );
    println!("🎉 {}", result);
    Ok(result)
}

// PHASE 3: Conversation insights and recommendations
#[tauri::command]
async fn find_related_conversations(
    current_messages: Vec<Message>,
    current_project_id: Option<String>,
    current_thread_id: String,
) -> Result<Vec<rag::ConversationRef>, String> {
    println!("🔍 Finding related conversations for thread: {}", current_thread_id);
    
    match rag::find_related_conversations(
        &current_messages,
        current_project_id.as_deref(),
        &current_thread_id,
        5
    ).await {
        Ok(related) => {
            println!("✅ Found {} related conversations", related.len());
            Ok(related)
        },
        Err(e) => {
            eprintln!("❌ Failed to find related conversations: {}", e);
            Err(e)
        }
    }
}

// Enhanced RAG with cross-project insights
#[tauri::command]
async fn enhanced_rag_search(
    query: String,
    project_id: Option<String>,
    thread_id: String,
    include_cross_project: bool,
) -> Result<Vec<String>, String> {
    println!("🔍 Enhanced RAG search: '{}' (cross-project: {})", query, include_cross_project);
    
    let mut context = Vec::new();
    
    // Get project-specific context
    if let Some(pid) = &project_id {
        match rag::enhanced_query(&query, Some(pid), &thread_id, 3, 2).await {
            Ok(project_context) => {
                context.extend(project_context);
            },
            Err(e) => {
                eprintln!("❌ Project RAG failed: {}", e);
            }
        }
    }
    
    // Add cross-project insights if requested
    if include_cross_project {
        match rag::global_conversation_search(&query, project_id.as_deref(), &thread_id, 3).await {
            Ok(global_context) => {
                context.extend(global_context);
            },
            Err(e) => {
                eprintln!("❌ Global conversation search failed: {}", e);
            }
        }
    }
    
    println!("📋 Enhanced RAG found {} total context items", context.len());
    Ok(context)
}

// Qdrant Service Management Commands

#[tauri::command]
async fn start_qdrant() -> Result<String, String> {
    match qdrant_service::ensure_qdrant_running().await {
        Ok(()) => Ok("Qdrant service started successfully".to_string()),
        Err(e) => Err(format!("Failed to start Qdrant: {}", e))
    }
}

#[tauri::command]
async fn stop_qdrant() -> Result<String, String> {
    let service = qdrant_service::get_qdrant_service().await;
    let mut service = service.lock().await;
    match service.stop().await {
        Ok(()) => Ok("Qdrant service stopped".to_string()),
        Err(e) => Err(format!("Failed to stop Qdrant: {}", e))
    }
}

#[tauri::command]
async fn get_qdrant_status() -> Result<qdrant_service::QdrantStatus, String> {
    let status = qdrant_service::get_qdrant_status().await;
    Ok(status)
}

#[tauri::command]
async fn configure_qdrant(auto_start: bool, use_docker: bool, port: Option<u16>) -> Result<String, String> {
    let config = qdrant_service::QdrantConfig {
        auto_start,
        port: port.unwrap_or(6333),
        use_docker,
        data_path: None,
    };
    
    qdrant_service::init_qdrant_service(config);
    Ok("Qdrant configuration updated".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
// TODO: mobile build targets
pub fn run() {
    // Initialize Qdrant service with default config
    qdrant_service::init_qdrant_service(qdrant_service::QdrantConfig::default());
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|_app| {
            println!("🚀 Ollama Desktop started");
            println!("💡 Qdrant auto-start available - will start on first vectorization request");
            println!("   You can also manually start/stop Qdrant from the Settings page");
            Ok(())
        })
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
            vectorize_existing_conversations,
            find_related_conversations,
            enhanced_rag_search,
            start_qdrant,
            stop_qdrant,
            get_qdrant_status,
            configure_qdrant,
            audit_log::get_audit_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
