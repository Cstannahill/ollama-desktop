use reqwest::Client;
use crate::ollama_client;

const EMBED_MODEL: &str = "nomic-embed-text";

pub async fn embed(text: &str) -> anyhow::Result<Vec<f32>> {
    let client = Client::new();
    let mut req = client
        .post(format!("{}/api/embeddings", ollama_client::base_url()))
        .json(&serde_json::json!({
            "model": EMBED_MODEL,
            "prompt": text,
        }));
    if let Some(t) = ollama_client::bearer_token() {
        req = req.bearer_auth(t);
    }
    let v: serde_json::Value = req
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
