use async_stream::stream;
use futures_util::{Stream, StreamExt};
use reqwest::Client;
use serde_json::Value;

// pub async fn chat(
//     model: String,
//     prompt: String,
//     system: Option<String>,
// ) -> Result<impl Stream<Item = String>, reqwest::Error> {
//     let client = Client::new();
//     let mut messages = Vec::new();
//     if let Some(sys) = system {
//         messages.push(serde_json::json!({"role": "system", "content": sys}));
//     }
//     messages.push(serde_json::json!({"role": "user", "content": prompt}));

//     let res = client
//         .post("http://127.0.0.1:11434/api/chat")
//         .json(&serde_json::json!({
//             "model": model,
//             "stream": true,
//             "messages": messages,
//         }))
//         .send()
//         .await?;

//     let stream_resp = res.bytes_stream();

//     Ok(stream! {
//         let mut buf = Vec::new();
//         futures_util::pin_mut!(stream_resp);
//         while let Some(chunk) = stream_resp.next().await {
//             if let Ok(bytes) = chunk {
//                 buf.extend_from_slice(&bytes);
//                 while let Some(pos) = buf.iter().position(|b| *b == b'\n') {
//                     let line: Vec<u8> = buf.drain(..=pos).collect();
//                     let line_str = String::from_utf8_lossy(&line);
//                     let trimmed = line_str.trim();
//                     if trimmed.is_empty() { continue; }
//                     if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
//                         if let Some(content) = v["message"]["content"].as_str() {
//                             yield content.to_string();
//                         }
//                     }
//                 }
//             }
//         }
//     })
// }

pub async fn list_models() -> Result<Vec<String>, reqwest::Error> {
    let client = Client::new();
    let res = client
        .get("http://127.0.0.1:11434/api/tags")
        .send()
        .await?;
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
