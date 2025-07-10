use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct LogEntry {
    pub when: DateTime<Utc>,
    pub thread_id: String,
    pub tool: String,
    pub args: serde_json::Value,
    pub ok: bool,
}

static LOG: once_cell::sync::Lazy<std::sync::RwLock<Vec<LogEntry>>> =
    once_cell::sync::Lazy::new(|| std::sync::RwLock::new(Vec::new()));

pub fn record(entry: LogEntry) {
    LOG.write().unwrap().push(entry);
}

#[tauri::command]
pub fn get_audit_log(thread_id: String) -> Vec<LogEntry> {
    LOG
        .read()
        .unwrap()
        .iter()
        .filter(|e| e.thread_id == thread_id)
        .cloned()
        .collect()
}
