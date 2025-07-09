use async_trait::async_trait;
use serde::Serialize;
use serde_json::Value;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::RwLock;

use crate::web_search::WebSearchTool;

#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &'static str;
    fn description(&self) -> &'static str;
    fn json_schema(&self) -> Value;
    async fn call(&self, args: Value) -> anyhow::Result<String>;
}

#[derive(Serialize)]
pub struct ToolMeta {
    pub name: &'static str,
    pub description: &'static str,
    pub json_schema: Value,
}

pub fn registry() -> &'static RwLock<HashMap<&'static str, Box<dyn Tool + Send + Sync>>> {
    static REG: Lazy<RwLock<HashMap<&'static str, Box<dyn Tool + Send + Sync>>>> = Lazy::new(|| {
        let mut map: HashMap<&'static str, Box<dyn Tool + Send + Sync>> = HashMap::new();
        map.insert("web_search", Box::new(WebSearchTool) as Box<dyn Tool + Send + Sync>);
        // TODO: additional tools (file_read, file_write, shell_exec)
        RwLock::new(map)
    });
    &REG
}
