use anyhow::Result;
use serde_json::{json, Value};
use crate::Message;

// Rough token estimation (1 token ≈ 4 characters for most models)
const CHARS_PER_TOKEN: f32 = 4.0;

// Default context limits for different model types
const DEFAULT_CONTEXT_LIMIT: usize = 4096;  // Conservative default
const LARGE_MODEL_CONTEXT_LIMIT: usize = 8192;  // For larger models
const SYSTEM_PROMPT_RESERVE: usize = 500;   // Reserve tokens for system prompt
const RESPONSE_RESERVE: usize = 1000;       // Reserve tokens for response

pub struct ContextManager {
    max_context_tokens: usize,
}

impl ContextManager {
    pub fn new(model_name: Option<&str>) -> Self {
        let max_context_tokens = match model_name {
            Some(name) if name.contains("32k") => 32768,
            Some(name) if name.contains("16k") => 16384,
            Some(name) if name.contains("8k") || name.contains("large") => LARGE_MODEL_CONTEXT_LIMIT,
            _ => DEFAULT_CONTEXT_LIMIT,
        };
        
        Self { max_context_tokens }
    }
    
    /// Estimate token count for text
    pub fn estimate_tokens(&self, text: &str) -> usize {
        (text.len() as f32 / CHARS_PER_TOKEN).ceil() as usize
    }
    
    /// Estimate tokens for a message
    pub fn estimate_message_tokens(&self, message: &Message) -> usize {
        let content_tokens = self.estimate_tokens(&message.text);
        let role_tokens = self.estimate_tokens(&message.role);
        content_tokens + role_tokens + 10 // Add overhead for formatting
    }
    
    /// Calculate available tokens for conversation history
    pub fn available_context_tokens(&self, system_prompt: &str) -> usize {
        let system_tokens = self.estimate_tokens(system_prompt);
        let used_tokens = system_tokens + SYSTEM_PROMPT_RESERVE + RESPONSE_RESERVE;
        
        if used_tokens >= self.max_context_tokens {
            return 0;
        }
        
        self.max_context_tokens - used_tokens
    }
    
    /// Optimize conversation context to fit within token limits
    pub async fn optimize_conversation_context(
        &self,
        messages: &[Message],
        system_prompt: &str,
    ) -> Result<Vec<Value>> {
        let available_tokens = self.available_context_tokens(system_prompt);
        
        if messages.is_empty() {
            return Ok(vec![]);
        }
        
        // Always include the most recent messages
        let mut optimized_messages = Vec::new();
        let mut total_tokens = 0;
        
        // Start from the end (most recent) and work backwards
        let mut recent_messages = Vec::new();
        for message in messages.iter().rev() {
            if message.role == "tool" {
                continue; // Skip tool messages for cleaner context
            }
            
            let message_tokens = self.estimate_message_tokens(message);
            
            if total_tokens + message_tokens <= available_tokens {
                total_tokens += message_tokens;
                recent_messages.push(message);
            } else {
                break;
            }
        }
        
        // If we couldn't fit enough recent messages, try summarization
        if recent_messages.len() < 6 && messages.len() > 10 {
            println!("📝 Context window full, attempting summarization...");
            
            // Keep the last 4 messages and summarize the rest
            let keep_recent = 4;
            let mut summary_messages = Vec::new();
            let mut summary_tokens = 0;
            
            // Add most recent messages
            for message in messages.iter().rev().take(keep_recent) {
                if message.role != "tool" {
                    let message_tokens = self.estimate_message_tokens(message);
                    summary_tokens += message_tokens;
                    summary_messages.push(json!({
                        "role": message.role,
                        "content": message.text
                    }));
                }
            }
            
            // Generate summary of older messages if we have space
            let summary_space = available_tokens.saturating_sub(summary_tokens);
            if summary_space > 200 && messages.len() > keep_recent {
                let older_messages: Vec<&Message> = messages
                    .iter()
                    .rev()
                    .skip(keep_recent)
                    .filter(|m| m.role != "tool")
                    .collect();
                
                if let Ok(summary) = self.summarize_messages(&older_messages).await {
                    let summary_tokens = self.estimate_tokens(&summary);
                    if summary_tokens <= summary_space {
                        // Insert summary at the beginning
                        optimized_messages.push(json!({
                            "role": "system",
                            "content": format!("Previous conversation summary: {}", summary)
                        }));
                    }
                }
            }
            
            // Add recent messages (in correct order)
            summary_messages.reverse();
            optimized_messages.extend(summary_messages);
            
        } else {
            // We can fit messages without summarization
            recent_messages.reverse(); // Restore chronological order
            for message in recent_messages {
                optimized_messages.push(json!({
                    "role": message.role,
                    "content": message.text
                }));
            }
        }
        
        println!("🎯 Context optimization: {} messages → {} entries (~{} tokens)", 
                 messages.len(), optimized_messages.len(), total_tokens);
        
        Ok(optimized_messages)
    }
    
    /// Summarize a collection of messages
    async fn summarize_messages(&self, messages: &[&Message]) -> Result<String> {
        if messages.is_empty() {
            return Ok(String::new());
        }
        
        // Create conversation text for summarization
        let conversation_text: Vec<String> = messages
            .iter()
            .map(|m| format!("{}: {}", m.role, m.text))
            .collect();
        
        let combined_text = conversation_text.join("\n");
        
        // Try AI-powered summarization first, fallback to extractive
        match self.ai_summarize(&combined_text).await {
            Ok(summary) if !summary.trim().is_empty() => {
                println!("🤖 AI summarization successful");
                Ok(summary)
            },
            _ => {
                println!("📝 Using extractive summarization fallback");
                let summary = self.extractive_summary(&combined_text, 200);
                Ok(summary)
            }
        }
    }
    
    /// AI-powered summarization using Ollama
    async fn ai_summarize(&self, text: &str) -> Result<String> {
        let client = reqwest::Client::new();
        
        // Use a lightweight model for summarization to avoid recursion
        let summarization_prompt = format!(
            "Summarize the following conversation in 2-3 concise sentences, focusing on key topics and decisions:\n\n{}",
            text.chars().take(2000).collect::<String>() // Limit input size
        );
        
        let request_body = serde_json::json!({
            "model": "qwen2.5:0.5b",  // Use a small, fast model for summarization
            "prompt": summarization_prompt,
            "stream": false,
            "options": {
                "temperature": 0.3,  // Lower temperature for more focused summaries
                "top_p": 0.8,
                "num_ctx": 2048      // Smaller context for speed
            }
        });
        
        let response = client
            .post("http://127.0.0.1:11434/api/generate")
            .json(&request_body)
            .timeout(std::time::Duration::from_secs(15)) // Quick timeout
            .send()
            .await?;
        
        if !response.status().is_success() {
            anyhow::bail!("Ollama summarization request failed");
        }
        
        let response_json: serde_json::Value = response.json().await?;
        
        if let Some(summary) = response_json["response"].as_str() {
            Ok(summary.trim().to_string())
        } else {
            anyhow::bail!("No response in summarization result");
        }
    }
    
    /// Simple extractive summarization - takes key sentences
    fn extractive_summary(&self, text: &str, max_chars: usize) -> String {
        let sentences: Vec<&str> = text
            .split(&['.', '!', '?'])
            .map(|s| s.trim())
            .filter(|s| !s.is_empty() && s.len() > 20) // Filter out very short sentences
            .collect();
        
        if sentences.is_empty() {
            return text.chars().take(max_chars).collect();
        }
        
        // Score sentences by position (earlier = more important) and length
        let mut scored_sentences: Vec<(f32, &str)> = sentences
            .iter()
            .enumerate()
            .map(|(i, &sentence)| {
                let position_score = 1.0 - (i as f32 / sentences.len() as f32) * 0.5;
                let length_score = (sentence.len() as f32 / 100.0).min(1.0);
                let score = position_score + length_score;
                (score, sentence)
            })
            .collect();
        
        // Sort by score (highest first)
        scored_sentences.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        
        // Take sentences until we hit the character limit
        let mut summary = String::new();
        for (_, sentence) in scored_sentences {
            if summary.len() + sentence.len() + 2 <= max_chars {
                if !summary.is_empty() {
                    summary.push_str(". ");
                }
                summary.push_str(sentence);
            } else {
                break;
            }
        }
        
        if summary.is_empty() {
            // Fallback: just truncate
            text.chars().take(max_chars).collect()
        } else {
            summary
        }
    }
    
    /// Check if a conversation needs context optimization
    pub fn needs_optimization(&self, messages: &[Message], system_prompt: &str) -> bool {
        let available_tokens = self.available_context_tokens(system_prompt);
        let current_tokens: usize = messages
            .iter()
            .filter(|m| m.role != "tool")
            .map(|m| self.estimate_message_tokens(m))
            .sum();
        
        current_tokens > available_tokens
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    fn create_test_message(role: &str, text: &str) -> Message {
        Message {
            id: uuid::Uuid::new_v4().to_string(),
            role: role.to_string(),
            text: text.to_string(),
            name: None,
            attachments: None,
        }
    }
    
    #[test]
    fn test_token_estimation() {
        let manager = ContextManager::new(None);
        
        // Test basic token estimation
        assert!(manager.estimate_tokens("hello world") > 0);
        assert!(manager.estimate_tokens("a much longer sentence with many words") > 
                manager.estimate_tokens("short"));
        
        // Test message token estimation
        let message = create_test_message("user", "Hello, how are you?");
        let tokens = manager.estimate_message_tokens(&message);
        assert!(tokens > 0);
        assert!(tokens > manager.estimate_tokens("Hello, how are you?")); // Should include role overhead
    }
    
    #[test]
    fn test_model_specific_context_limits() {
        // Test default model
        let default_manager = ContextManager::new(None);
        assert_eq!(default_manager.max_context_tokens, DEFAULT_CONTEXT_LIMIT);
        
        // Test 32k model
        let large_manager = ContextManager::new(Some("llama2-32k"));
        assert_eq!(large_manager.max_context_tokens, 32768);
        
        // Test 16k model
        let medium_manager = ContextManager::new(Some("gpt-16k"));
        assert_eq!(medium_manager.max_context_tokens, 16384);
        
        // Test 8k model
        let small_manager = ContextManager::new(Some("claude-large"));
        assert_eq!(small_manager.max_context_tokens, LARGE_MODEL_CONTEXT_LIMIT);
    }
    
    #[test]
    fn test_available_context_tokens() {
        let manager = ContextManager::new(None);
        let system_prompt = "You are a helpful assistant.";
        
        let available = manager.available_context_tokens(system_prompt);
        let expected = DEFAULT_CONTEXT_LIMIT - 
                      manager.estimate_tokens(system_prompt) - 
                      SYSTEM_PROMPT_RESERVE - 
                      RESPONSE_RESERVE;
        
        assert_eq!(available, expected);
    }
    
    #[test]
    fn test_needs_optimization() {
        let manager = ContextManager::new(None);
        let system_prompt = "Short prompt";
        
        // Test with few messages - should not need optimization
        let short_messages = vec![
            create_test_message("user", "Hello"),
            create_test_message("assistant", "Hi there!"),
        ];
        assert!(!manager.needs_optimization(&short_messages, system_prompt));
        
        // Test with many long messages - should need optimization
        let long_text = "This is a very long message that contains many words and should consume a significant number of tokens when processed by the language model because it has a lot of content and information that needs to be tokenized and understood.".repeat(10);
        let long_messages = vec![create_test_message("user", &long_text); 20];
        assert!(manager.needs_optimization(&long_messages, system_prompt));
    }
    
    #[tokio::test]
    async fn test_optimize_conversation_context_empty() {
        let manager = ContextManager::new(None);
        let system_prompt = "You are helpful";
        
        let result = manager.optimize_conversation_context(&[], system_prompt).await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }
    
    #[tokio::test]
    async fn test_optimize_conversation_context_within_limit() {
        let manager = ContextManager::new(None);
        let system_prompt = "Short prompt";
        
        let messages = vec![
            create_test_message("user", "Hello"),
            create_test_message("assistant", "Hi there!"),
            create_test_message("user", "How are you?"),
            create_test_message("assistant", "I'm doing well, thanks!"),
        ];
        
        let result = manager.optimize_conversation_context(&messages, system_prompt).await;
        assert!(result.is_ok());
        
        let optimized = result.unwrap();
        assert_eq!(optimized.len(), 4); // All messages should fit
        
        // Check message content is preserved
        assert_eq!(optimized[0]["content"], "Hello");
        assert_eq!(optimized[1]["content"], "Hi there!");
    }
    
    #[test]
    fn test_extractive_summary() {
        let manager = ContextManager::new(None);
        let text = "This is the first sentence. This is a second important sentence! And here's a third one? Short.";
        
        let summary = manager.extractive_summary(text, 100);
        assert!(!summary.is_empty());
        assert!(summary.len() <= 100);
        
        // Test with very short limit
        let short_summary = manager.extractive_summary(text, 20);
        assert!(!short_summary.is_empty());
        assert!(short_summary.len() <= 20);
        
        // Test with empty text
        let empty_summary = manager.extractive_summary("", 100);
        assert!(empty_summary.is_empty());
    }
    
    #[test] 
    fn test_extractive_summary_sentence_scoring() {
        let manager = ContextManager::new(None);
        
        // Create text where first sentence should score higher (position-based scoring)
        let text = "This is the most important first sentence with good length. Short. Another sentence here.";
        
        let summary = manager.extractive_summary(text, 200);
        assert!(summary.contains("important first sentence"));
    }
}