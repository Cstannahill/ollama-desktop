use reqwest::Client;

const EMBED_MODEL: &str = "nomic-embed-text";

pub async fn embed(text: &str) -> anyhow::Result<Vec<f32>> {
    let client = Client::new();
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
