use serde_json::{json, Value};
use crate::tool::Tool;

pub struct WebSearchTool;

#[async_trait::async_trait]
impl Tool for WebSearchTool {
    fn name(&self) -> &'static str { "web_search" }

    fn description(&self) -> &'static str { "Search the web and return brief results" }

    fn json_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "query": { "type": "string", "description": "Search phrase" }
            },
            "required": ["query"]
        })
    }

    async fn call(&self, _window: &tauri::Window, args: Value) -> anyhow::Result<String> {
        let q = args.get("query").and_then(|v| v.as_str()).unwrap_or_default();
        if q.len() > 200 {
            anyhow::bail!("query too long");
        }
        
        // Try DuckDuckGo instant answers first
        let resp: Value = reqwest::Client::new()
            .get("https://api.duckduckgo.com/")
            .query(&[("q", q), ("format", "json"), ("no_html", "1"), ("skip_disambig", "1")])
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await?
            .json()
            .await?;
        
        let mut out = String::new();
        
        // Check for instant answer first
        if let Some(abstract_text) = resp.get("Abstract").and_then(|v| v.as_str()) {
            if !abstract_text.is_empty() {
                out.push_str(&format!("## {}\n\n{}\n\n", 
                    resp.get("Heading").and_then(|v| v.as_str()).unwrap_or("Result"), 
                    abstract_text));
                if let Some(url) = resp.get("AbstractURL").and_then(|v| v.as_str()) {
                    if !url.is_empty() {
                        out.push_str(&format!("Source: {}\n\n", url));
                    }
                }
            }
        }
        
        // Check for definition
        if let Some(definition) = resp.get("Definition").and_then(|v| v.as_str()) {
            if !definition.is_empty() {
                out.push_str(&format!("**Definition**: {}\n\n", definition));
                if let Some(url) = resp.get("DefinitionURL").and_then(|v| v.as_str()) {
                    if !url.is_empty() {
                        out.push_str(&format!("Source: {}\n\n", url));
                    }
                }
            }
        }
        
        // Check related topics
        if let Some(arr) = resp.get("RelatedTopics").and_then(|v| v.as_array()) {
            if !arr.is_empty() {
                out.push_str("## Related Information:\n\n");
                for (i, t) in arr.iter().take(5).enumerate() {
                    if let (Some(text), Some(url)) = (t.get("Text").and_then(|v| v.as_str()), t.get("FirstURL").and_then(|v| v.as_str())) {
                        if !text.is_empty() && !url.is_empty() {
                            out.push_str(&format!("{}. [{}]({})\n", i + 1, text, url));
                        }
                    }
                }
                out.push('\n');
            }
        }
        
        // Check answer
        if let Some(answer) = resp.get("Answer").and_then(|v| v.as_str()) {
            if !answer.is_empty() {
                out.push_str(&format!("**Answer**: {}\n\n", answer));
            }
        }
        
        // If still empty, provide a more helpful message
        if out.trim().is_empty() { 
            out = format!("I searched for '{}' but didn't find specific results. You might want to try:\n\n1. Rephrasing your query\n2. Using more specific terms\n3. Checking the spelling\n\nExample searches that work well:\n- 'rust programming language'\n- 'machine learning definition'\n- 'how to install nodejs'", q);
        }
        
        Ok(out)
    }
}
