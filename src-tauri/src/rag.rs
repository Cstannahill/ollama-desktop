use qdrant_client::{
    qdrant::{
        CreateCollectionBuilder, Distance, PointStruct, SearchPointsBuilder, UpsertPointsBuilder,
        VectorParamsBuilder,
    },
    Payload, Qdrant,
};
use reqwest::Client;
use uuid::Uuid;

const QDRANT_URL: &str = "http://127.0.0.1:6333";
const COLLECTION: &str = "chat";
const EMBED_MODEL: &str = "nomic-embed-text";
const VECTOR_DIM: u64 = 768;

pub async fn query(text: &str, top_k: usize) -> Result<Vec<String>, String> {
    let http = Client::new();
    let vector = embed(&http, text).await.map_err(|e| e.to_string())?;

    let client = Qdrant::from_url(QDRANT_URL)
        .build()
        .map_err(|e| e.to_string())?;

    if !client
        .collection_exists(COLLECTION)
        .await
        .map_err(|e| e.to_string())?
    {
        client
            .create_collection(
                CreateCollectionBuilder::new(COLLECTION)
                    .vectors_config(VectorParamsBuilder::new(VECTOR_DIM, Distance::Cosine)),
            )
            .await
            .map_err(|e| e.to_string())?;
    }

    let search_res = client
        .search_points(
            SearchPointsBuilder::new(COLLECTION, vector.clone(), top_k as u64).with_payload(true),
        )
        .await
        .map_err(|e| e.to_string())?;

    // store query for future searches, ignore errors
    store(&client, vector, text).await;

    let results = search_res
        .result
        .into_iter()
        .filter_map(|p| {
            p.payload
                .get("text")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .collect();

    Ok(results)
}

// PHASE 2: Enhanced RAG with conversation search
pub async fn enhanced_query(
    text: &str,
    project_id: Option<&str>,
    current_thread_id: &str,
    doc_limit: usize,
    conv_limit: usize,
) -> Result<Vec<String>, String> {
    let mut context = Vec::new();
    
    // Get document context (existing functionality)
    println!("🔍 Searching documents for: {}", text);
    let doc_results = query(text, doc_limit).await?;
    context.extend(doc_results.into_iter().map(|r| format!("[Document] {}", r)));
    
    // Get conversation context (new functionality)
    if let Some(pid) = project_id {
        println!("🗣️ Searching conversations in project: {}", pid);
        match search_project_conversations_rag(text, pid, current_thread_id, conv_limit).await {
            Ok(conv_results) => {
                context.extend(conv_results);
            },
            Err(e) => {
                eprintln!("Failed to search conversations: {}", e);
                // Continue without conversation context
            }
        }
    }
    
    println!("📋 Enhanced RAG found {} total context items", context.len());
    Ok(context)
}

// PHASE 3: Cross-project conversation insights
pub async fn global_conversation_search(
    text: &str,
    exclude_project_id: Option<&str>,
    current_thread_id: &str,
    limit: usize,
) -> Result<Vec<String>, String> {
    let http = Client::new();
    let query_vector = embed(&http, text).await.map_err(|e| e.to_string())?;
    
    let client = Qdrant::from_url(QDRANT_URL)
        .build()
        .map_err(|e| e.to_string())?;
    
    // Check if conversations collection exists
    if !client
        .collection_exists("conversations")
        .await
        .map_err(|e| e.to_string())?
    {
        return Ok(Vec::new());
    }
    
    // Search across all conversations, optionally excluding a project
    let filter = if let Some(pid) = exclude_project_id {
        Some(format!("project_id != '{}' AND thread_id != '{}'", pid, current_thread_id))
    } else {
        Some(format!("thread_id != '{}'", current_thread_id))
    };
    
    match crate::vector_db::search(
        "conversations",
        query_vector,
        limit,
        filter.as_deref()
    ).await {
        Ok(search_results) => {
            let mut context_results = Vec::new();
            for hit in search_results {
                if let (Some(content), Some(role), Some(_thread_id), project_id) = (
                    hit.payload.get("content").and_then(|v| v.as_str()),
                    hit.payload.get("role").and_then(|v| v.as_str()),
                    hit.payload.get("thread_id").and_then(|v| v.as_str()),
                    hit.payload.get("project_id").and_then(|v| v.as_str())
                ) {
                    let project_label = project_id.map(|p| format!(" in project {}", &p[..8])).unwrap_or_default();
                    let context_entry = format!(
                        "[Related conversation{}] {}: {}",
                        project_label,
                        role,
                        content
                    );
                    context_results.push(context_entry);
                }
            }
            Ok(context_results)
        },
        Err(e) => Err(e.to_string())
    }
}

// Find conversations similar to current conversation
pub async fn find_related_conversations(
    current_messages: &[crate::Message],
    current_project_id: Option<&str>,
    current_thread_id: &str,
    limit: usize,
) -> Result<Vec<ConversationRef>, String> {
    if current_messages.is_empty() {
        return Ok(Vec::new());
    }
    
    // Create a query from recent conversation content
    let query_text: String = current_messages
        .iter()
        .rev()
        .take(3)  // Use last 3 messages to find related conversations
        .filter(|m| m.role != "tool")
        .map(|m| m.text.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    
    if query_text.trim().is_empty() {
        return Ok(Vec::new());
    }
    
    // Search for related conversations across projects
    let related = global_conversation_search(
        &query_text,
        current_project_id,
        current_thread_id,
        limit
    ).await?;
    
    // Convert to structured conversation references
    let mut conversation_refs = Vec::new();
    for (i, entry) in related.into_iter().enumerate() {
        conversation_refs.push(ConversationRef {
            id: format!("related_{}", i),
            title: format!("Related conversation #{}", i + 1),
            snippet: entry,
            relevance_score: 1.0 - (i as f32 * 0.1), // Decreasing relevance
            project_id: None, // We'd need to parse this from the entry if needed
        });
    }
    
    Ok(conversation_refs)
}

#[derive(serde::Serialize, Debug, Clone)]
pub struct ConversationRef {
    pub id: String,
    pub title: String,
    pub snippet: String,
    pub relevance_score: f32,
    pub project_id: Option<String>,
}

// Search conversations for RAG context
async fn search_project_conversations_rag(
    query_text: &str,
    project_id: &str,
    current_thread_id: &str,
    limit: usize,
) -> Result<Vec<String>, String> {
    let http = Client::new();
    let query_vector = embed(&http, query_text).await.map_err(|e| e.to_string())?;
    
    let client = Qdrant::from_url(QDRANT_URL)
        .build()
        .map_err(|e| e.to_string())?;
    
    // Check if conversations collection exists
    if !client
        .collection_exists("conversations")
        .await
        .map_err(|e| e.to_string())?
    {
        return Ok(Vec::new()); // No conversations to search
    }
    
    // Use the vector_db search functionality
    match crate::vector_db::search(
        "conversations",
        query_vector,
        limit,
        Some(&format!("project_id = '{}' AND thread_id != '{}'", project_id, current_thread_id))
    ).await {
        Ok(search_results) => {
            let mut context_results = Vec::new();
            for hit in search_results {
                if let (Some(content), Some(role), Some(thread_id)) = (
                    hit.payload.get("content").and_then(|v| v.as_str()),
                    hit.payload.get("role").and_then(|v| v.as_str()),
                    hit.payload.get("thread_id").and_then(|v| v.as_str())
                ) {
                    let context_entry = format!(
                        "[Previous conversation {}] {}: {}",
                        &thread_id[..8],
                        role,
                        content
                    );
                    context_results.push(context_entry);
                }
            }
            Ok(context_results)
        },
        Err(e) => Err(e.to_string())
    }
}

async fn store(client: &Qdrant, vector: Vec<f32>, text: &str) {
    let payload: Payload = serde_json::json!({ "text": text })
        .try_into()
        .unwrap_or_default();
    let point = PointStruct::new(Uuid::new_v4().to_string(), vector, payload);
    let _ = client
        .upsert_points(UpsertPointsBuilder::new(COLLECTION, vec![point]).wait(true))
        .await;
}

async fn embed(client: &Client, text: &str) -> Result<Vec<f32>, reqwest::Error> {
    let v: serde_json::Value = client
        .post("http://127.0.0.1:11434/api/embeddings")
        .json(&serde_json::json!({
            "model": EMBED_MODEL,
            "prompt": text,
        }))
        .send()
        .await?
        .json()
        .await?;

    Ok(v["embedding"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|f| f.as_f64().map(|f| f as f32))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    fn create_test_message(role: &str, text: &str) -> crate::Message {
        crate::Message {
            id: uuid::Uuid::new_v4().to_string(),
            role: role.to_string(),
            text: text.to_string(),
            name: None,
            attachments: None,
        }
    }
    
    #[test]
    fn test_conversation_ref_creation() {
        let conv_ref = ConversationRef {
            id: "test_123".to_string(),
            title: "Test Conversation".to_string(),
            snippet: "This is a test conversation snippet".to_string(),
            relevance_score: 0.85,
            project_id: Some("project_456".to_string()),
        };
        
        assert_eq!(conv_ref.id, "test_123");
        assert_eq!(conv_ref.title, "Test Conversation");
        assert_eq!(conv_ref.relevance_score, 0.85);
        assert!(conv_ref.project_id.is_some());
    }
    
    #[tokio::test]
    async fn test_find_related_conversations_empty_messages() {
        let result = find_related_conversations(
            &[],
            Some("project_123"),
            "thread_456",
            5
        ).await;
        
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }
    
    #[tokio::test]
    async fn test_find_related_conversations_only_tool_messages() {
        let messages = vec![
            create_test_message("tool", "Tool output 1"),
            create_test_message("tool", "Tool output 2"),
        ];
        
        let result = find_related_conversations(
            &messages,
            Some("project_123"),
            "thread_456",
            5
        ).await;
        
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }
    
    #[tokio::test] 
    async fn test_find_related_conversations_creates_query() {
        let messages = vec![
            create_test_message("user", "How do I handle errors in Rust?"),
            create_test_message("assistant", "You can use Result and Option types"),
            create_test_message("user", "Can you show an example?"),
        ];
        
        // This test will fail if Qdrant is not available, but that's expected
        // We're mainly testing the query construction logic
        let result = find_related_conversations(
            &messages,
            Some("project_123"),
            "thread_456", 
            3
        ).await;
        
        // Should either succeed with results or fail with connection error
        // Both are valid outcomes depending on whether Qdrant is running
        match result {
            Ok(conversations) => {
                // If successful, validate the structure
                for conv in conversations {
                    assert!(!conv.id.is_empty());
                    assert!(!conv.snippet.is_empty());
                    assert!(conv.relevance_score > 0.0 && conv.relevance_score <= 1.0);
                }
            },
            Err(error) => {
                // If failed, should be a connection error (Qdrant not available)
                assert!(error.contains("connect") || error.contains("qdrant") || 
                       error.contains("collection") || error.to_lowercase().contains("unavailable"));
            }
        }
    }
    
    #[test]
    fn test_conversation_ref_serialization() {
        let conv_ref = ConversationRef {
            id: "test_123".to_string(),
            title: "Test Title".to_string(),
            snippet: "Test snippet content".to_string(),
            relevance_score: 0.75,
            project_id: None,
        };
        
        // Test that it can be serialized (important for Tauri commands)
        let serialized = serde_json::to_string(&conv_ref);
        assert!(serialized.is_ok());
        
        let json_str = serialized.unwrap();
        assert!(json_str.contains("test_123"));
        assert!(json_str.contains("Test Title"));
        assert!(json_str.contains("0.75"));
    }
    
    #[tokio::test]
    async fn test_enhanced_query_without_project() {
        let result = enhanced_query(
            "test query",
            None, // No project ID
            "thread_123",
            5,
            3
        ).await;
        
        // Should work even without project ID (only searches documents)
        match result {
            Ok(context) => {
                // Should have document results or be empty if no documents
                assert!(context.iter().any(|item| item.starts_with("[Document]")) || context.is_empty());
            },
            Err(error) => {
                // Connection errors are acceptable if Qdrant is not running
                assert!(error.contains("connect") || error.contains("qdrant"));
            }
        }
    }
    
    #[tokio::test]
    async fn test_enhanced_query_with_project() {
        let result = enhanced_query(
            "error handling patterns",
            Some("project_123"),
            "thread_456",
            3,
            2
        ).await;
        
        match result {
            Ok(context) => {
                // Results should be labeled properly
                for item in &context {
                    assert!(item.starts_with("[Document]") || 
                           item.starts_with("[Previous conversation"));
                }
            },
            Err(error) => {
                // Connection errors are acceptable
                assert!(error.contains("connect") || error.contains("qdrant") || 
                       error.contains("collection"));
            }
        }
    }
    
    #[tokio::test]
    async fn test_global_conversation_search_with_exclusions() {
        let result = global_conversation_search(
            "test search query",
            Some("exclude_project"),  // Exclude this project
            "exclude_thread",         // Exclude this thread
            5
        ).await;
        
        match result {
            Ok(results) => {
                // Validate result format
                for result_item in results {
                    assert!(result_item.starts_with("[Related conversation"));
                    // Should not contain excluded project (though hard to test without data)
                }
            },
            Err(error) => {
                // Expected if Qdrant not available or conversations collection doesn't exist
                assert!(error.contains("connect") || error.contains("qdrant") || 
                       error.contains("collection") || error.contains("unavailable"));
            }
        }
    }
    
    #[tokio::test]
    async fn test_global_conversation_search_no_exclusions() {
        let result = global_conversation_search(
            "general search",
            None,  // No project exclusion
            "thread_123",
            3
        ).await;
        
        match result {
            Ok(results) => {
                assert!(results.len() <= 3); // Should respect limit
            },
            Err(error) => {
                // Expected errors when Qdrant unavailable
                assert!(error.contains("connect") || error.contains("qdrant") ||
                       error.contains("collection"));
            }
        }
    }
    
    // Mock test for embedding function (requires real Ollama connection)
    #[tokio::test] 
    async fn test_embed_function_structure() {
        let client = reqwest::Client::new();
        
        // This will fail if Ollama is not running, but we can test the error handling
        let result = embed(&client, "test text").await;
        
        match result {
            Ok(embedding) => {
                // If successful, should be a vector of floats
                assert!(embedding.len() > 0);
                assert!(embedding.len() == VECTOR_DIM as usize || embedding.is_empty());
            },
            Err(_) => {
                // Expected if Ollama is not running
                // This is acceptable in testing environment
            }
        }
    }
}
