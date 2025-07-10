use async_trait::async_trait;
use once_cell::sync::Lazy;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

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

pub fn registry() -> &'static RwLock<HashMap<&'static str, Arc<dyn Tool + Send + Sync>>> {
    static REG: Lazy<RwLock<HashMap<&'static str, Arc<dyn Tool + Send + Sync>>>> =
        Lazy::new(|| {
            let mut map: HashMap<&'static str, Arc<dyn Tool + Send + Sync>> = HashMap::new();
            map.insert(
                "web_search",
                Arc::new(WebSearchTool) as Arc<dyn Tool + Send + Sync>,
            );
            map.insert(
                "file_read",
                Arc::new(crate::file_tools::FileReadTool) as Arc<dyn Tool + Send + Sync>,
            );
            map.insert(
                "file_write",
                Arc::new(crate::file_tools::FileWriteTool) as Arc<dyn Tool + Send + Sync>,
            );
            // TODO: shell_exec tool (limited commands, timeout, permission)
            RwLock::new(map)
        });
    &REG
}
