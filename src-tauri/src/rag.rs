use reqwest::Client;
use qdrant_client::{
    payload::Payload,
    qdrant::{CreateCollectionBuilder, Distance, PointStruct, SearchPointsBuilder, UpsertPointsBuilder, VectorParamsBuilder},
    Qdrant,
};
use uuid::Uuid;

const QDRANT_URL: &str = "http://127.0.0.1:6333";
const COLLECTION: &str = "chat";
const EMBED_MODEL: &str = "nomic-embed-text";
const VECTOR_DIM: u64 = 768;

pub async fn query(text: &str, top_k: usize) -> Result<Vec<String>, String> {
    let http = Client::new();
    let vector = embed(&http, text).await.map_err(|e| e.to_string())?;

    let client = Qdrant::from_url(QDRANT_URL)
        .build()
        .map_err(|e| e.to_string())?;

    if !client
        .collection_exists(COLLECTION)
        .await
        .map_err(|e| e.to_string())?
    {
        client
            .create_collection(
                CreateCollectionBuilder::new(COLLECTION)
                    .vectors_config(VectorParamsBuilder::new(VECTOR_DIM, Distance::Cosine)),
            )
            .await
            .map_err(|e| e.to_string())?;
    }

    let search_res = client
        .search_points(
            SearchPointsBuilder::new(COLLECTION, vector.clone(), top_k as u64)
                .with_payload(true),
        )
        .await
        .map_err(|e| e.to_string())?;

    // store query for future searches, ignore errors
    store(&client, vector, text).await;

    let results = search_res
        .result
        .into_iter()
        .filter_map(|p| {
            p.payload.and_then(|payload| {
                let value: serde_json::Value = payload.into();
                value.get("text").and_then(|v| v.as_str()).map(|s| s.to_string())
            })
        })
        .collect();

    Ok(results)
}

async fn store(client: &Qdrant, vector: Vec<f32>, text: &str) {
    let payload: Payload = serde_json::json!({ "text": text }).try_into().unwrap_or_default();
    let point = PointStruct::new(Uuid::new_v4().to_string(), vector, payload);
    let _ = client
        .upsert_points(UpsertPointsBuilder::new(COLLECTION, vec![point]).wait(true))
        .await;
}

async fn embed(client: &Client, text: &str) -> Result<Vec<f32>, reqwest::Error> {
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
