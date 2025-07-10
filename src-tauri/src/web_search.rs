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
        let resp: Value = reqwest::Client::new()
            .get("https://api.duckduckgo.com/")
            .query(&[("q", q), ("format", "json")])
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await?
            .json()
            .await?;
        let mut out = String::new();
        if let Some(arr) = resp.get("RelatedTopics").and_then(|v| v.as_array()) {
            for (i, t) in arr.iter().take(5).enumerate() {
                if let (Some(text), Some(url)) = (t.get("Text").and_then(|v| v.as_str()), t.get("FirstURL").and_then(|v| v.as_str())) {
                    if i > 0 { out.push('\n'); }
                    out.push_str(&format!("* [{}]({}) – {}", text, url, q));
                }
            }
        }
        if out.is_empty() { out = "No results found".into(); }
        Ok(out)
    }
}
