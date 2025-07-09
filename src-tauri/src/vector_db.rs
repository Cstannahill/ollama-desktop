use qdrant_client::{
    qdrant::{
        CreateCollectionBuilder, Distance, PointStruct, UpsertPointsBuilder, VectorParamsBuilder,
    },
    Payload, Qdrant,
};

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
