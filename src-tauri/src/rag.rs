use uuid::Uuid;
use tiktoken_rs::get_bpe_from_model;
use crate::{embeddings, vector_db};

pub async fn retrieve_context(text: &str, thread_id: &Uuid, top_k: u8, ctx_tokens: usize) -> anyhow::Result<String> {
    let vector = embeddings::embed(text).await?;
    let points = vector_db::search_weighted(vector, top_k, thread_id).await?;
    let enc = get_bpe_from_model("gpt-3.5-turbo")?;
    let mut used = 0usize;
    let mut out = String::new();
    out.push_str(&format!("# Retrieved context (max {} tokens | top {} results)\n", ctx_tokens, top_k));
    for p in points {
        let txt = p.payload.get("text").and_then(|v| v.as_str()).unwrap_or("");
        let w = p.payload.get("weight").and_then(|v| v.as_f64()).unwrap_or(1.0);
        let chunk = format!("— ({:.1}×)\n{}\n", w, txt);
        used += enc.encode_with_special_tokens(&chunk).len();
        if used > ctx_tokens { break; }
        out.push_str(&chunk);
    }
    Ok(out)
}
