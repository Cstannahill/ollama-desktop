use qdrant_client::{
    qdrant::{
        CreateCollectionBuilder, Distance, PointStruct, UpsertPointsBuilder, VectorParamsBuilder,
        SearchPointsBuilder, Filter, FieldCondition, Condition, OverwritePayloadBuilder
    },
    qdrant::ScoredPoint,
    Payload, Qdrant,
};
use uuid::Uuid;

const QDRANT_URL: &str = "http://127.0.0.1:6333";
const COLLECTION: &str = "chat";
const VECTOR_DIM: u64 = 768;

async fn get_client() -> anyhow::Result<Qdrant> {
    let client = Qdrant::from_url(QDRANT_URL).build()?;
    if !client.collection_exists(COLLECTION).await? {
        client
            .create_collection(
                CreateCollectionBuilder::new(COLLECTION)
                    .vectors_config(VectorParamsBuilder::new(VECTOR_DIM, Distance::Cosine)),
            )
            .await?;
    }
    Ok(client)
}

pub async fn upsert(id: &str, vector: Vec<f32>, payload: serde_json::Value) -> anyhow::Result<()> {
    let client = get_client().await?;
    let payload: Payload = payload.try_into()?;
    let point = PointStruct::new(id.to_string(), vector, payload);
    client
        .upsert_points(UpsertPointsBuilder::new(COLLECTION, vec![point]).wait(true))
        .await?;
    Ok(())
}

pub async fn set_weight(id: &str, weight: f32) -> anyhow::Result<()> {
    let client = get_client().await?;
    let payload: Payload = serde_json::json!({"weight": weight}).try_into()?;
    client
        .overwrite_payload(
            qdrant_client::qdrant::OverwritePayloadBuilder::new(COLLECTION)
                .payload(payload)
                .points(vec![id]),
        )
        .await?;
    Ok(())
}

pub async fn search_weighted(vec: Vec<f32>, top_k: u8, thread_id: &Uuid) -> anyhow::Result<Vec<ScoredPoint>> {
    let client = get_client().await?;
    let search = client
        .search_points(
            SearchPointsBuilder::new(COLLECTION, vec, top_k as u64)
                .with_filter(Filter::new_must([Condition::Field(FieldCondition::must_match("thread_id", thread_id.to_string()))]))
                .with_payload(true),
        )
        .await?;
    let mut pts: Vec<ScoredPoint> = search.result.into_iter().collect();
    for p in pts.iter_mut() {
        let w = p
            .payload
            .get("weight")
            .and_then(|v| v.as_f64())
            .unwrap_or(1.0);
        p.score *= w as f32;
    }
    pts.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
    pts.truncate(top_k as usize);
    Ok(pts)
}
