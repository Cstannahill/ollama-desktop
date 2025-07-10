use async_stream::stream;
use futures_util::{Stream, StreamExt};
use once_cell::sync::Lazy;
use reqwest::Client;
use serde_json::Value;
use std::sync::Mutex;

static BASE_URL: Lazy<Mutex<String>> = Lazy::new(|| Mutex::new("http://127.0.0.1:11434".to_string()));
static TOKEN: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

pub fn set_server(host: String, port: u16, token: Option<String>) {
    let base = format!("{}:{}", host.trim_end_matches('/'), port);
    *BASE_URL.lock().unwrap() = base;
    *TOKEN.lock().unwrap() = token;
}

pub fn base_url() -> String {
    BASE_URL.lock().unwrap().clone()
}

pub fn bearer_token() -> Option<String> {
    TOKEN.lock().unwrap().clone()
}

pub async fn ping() -> Result<(), reqwest::Error> {
    let client = Client::new();
    let mut req = client.get(format!("{}/api/tags", base_url()));
    if let Some(t) = bearer_token() {
        req = req.bearer_auth(t);
    }
    req.send().await?.error_for_status()?;
    Ok(())
}

pub async fn chat(
    model: String,
    prompt: String,
    system: Option<String>,
) -> Result<impl Stream<Item = String>, reqwest::Error> {
    let client = Client::new();
    let mut messages = Vec::new();
    if let Some(sys) = system {
        messages.push(serde_json::json!({"role": "system", "content": sys}));
    }
    messages.push(serde_json::json!({"role": "user", "content": prompt}));

    let mut req = client
        .post(format!("{}/api/chat", base_url()))
        .json(&serde_json::json!({
            "model": model,
            "stream": true,
            "messages": messages,
        }));
    if let Some(t) = bearer_token() {
        req = req.bearer_auth(t);
    }
    let res = req.send().await?;

    let stream_resp = res.bytes_stream();

    Ok(stream! {
        let mut buf = Vec::new();
        futures_util::pin_mut!(stream_resp);
        while let Some(chunk) = stream_resp.next().await {
            if let Ok(bytes) = chunk {
                buf.extend_from_slice(&bytes);
                while let Some(pos) = buf.iter().position(|b| *b == b'\n') {
                    let line: Vec<u8> = buf.drain(..=pos).collect();
                    let line_str = String::from_utf8_lossy(&line);
                    let trimmed = line_str.trim();
                    if trimmed.is_empty() { continue; }
                    if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
                        if let Some(content) = v["message"]["content"].as_str() {
                            yield content.to_string();
                        }
                    }
                }
            }
        }
    })
}

pub async fn list_models() -> Result<Vec<String>, reqwest::Error> {
    let client = Client::new();
    let mut req = client.get(format!("{}/api/tags", base_url()));
    if let Some(t) = bearer_token() {
        req = req.bearer_auth(t);
    }
    let res = req.send().await?;
    let v: Value = res.json().await?;
    let models = v["models"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    Ok(models)
}
