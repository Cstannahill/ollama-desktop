use once_cell::sync::OnceCell;
use sqlx::{Pool, Sqlite, sqlite::SqlitePoolOptions};

static POOL: OnceCell<Pool<Sqlite>> = OnceCell::new();

pub async fn pool() -> anyhow::Result<&'static Pool<Sqlite>> {
    POOL.get_or_try_init(|| async {
        std::fs::create_dir_all(crate::config::WORKSPACE_DIR)?;
        let path = format!("{}/chat.sqlite", crate::config::WORKSPACE_DIR);
        let url = format!("sqlite://{}", path);
        let pool = SqlitePoolOptions::new().max_connections(5).connect(&url).await?;
        sqlx::migrate!("../migrations").run(&pool).await?;
        Ok(pool)
    }).await
}

pub async fn insert_vector(id: &str, thread_id: &str) -> anyhow::Result<()> {
    let pool = pool().await?;
    sqlx::query!("INSERT OR IGNORE INTO message_vectors(id, thread_id) VALUES(?, ?)", id, thread_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_weight(id: &str, weight: f32) -> anyhow::Result<()> {
    let pool = pool().await?;
    sqlx::query!("UPDATE message_vectors SET weight=? WHERE id=?", weight, id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn set_thread_settings(thread_id: &str, top_k: u8, ctx_tokens: u16) -> anyhow::Result<()> {
    let pool = pool().await?;
    sqlx::query!(
        "INSERT INTO thread_settings(thread_id, top_k, ctx_tokens) VALUES(?, ?, ?) \
         ON CONFLICT(thread_id) DO UPDATE SET top_k=excluded.top_k, ctx_tokens=excluded.ctx_tokens",
        thread_id,
        top_k as i64,
        ctx_tokens as i64
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_thread_settings(thread_id: &str) -> anyhow::Result<(u8, u16)> {
    let pool = pool().await?;
    if let Some(r) = sqlx::query!(
        "SELECT top_k, ctx_tokens FROM thread_settings WHERE thread_id=?",
        thread_id
    )
    .fetch_optional(pool)
    .await? {
        Ok((r.top_k as u8, r.ctx_tokens as u16))
    } else {
        Ok((4, 1024))
    }
}
