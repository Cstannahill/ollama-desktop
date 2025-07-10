use mime_guess::mime;
use std::path::PathBuf;
use uuid::Uuid;

use anyhow::Result;
use serde_json::json;

use crate::{chunk::chunk_text, embeddings, vector_db};

pub async fn ingest(path: PathBuf, thread_id: Uuid) -> Result<()> {
    let mime = mime_guess::from_path(&path).first_or_octet_stream();
    let raw_text = match (mime.type_(), mime.subtype().as_ref()) {
        (mime::APPLICATION, "pdf") => pdf_extract::extract_text(&path)?,
        (mime::TEXT, "plain") => std::fs::read_to_string(&path)?,
        (mime::TEXT, "markdown") => std::fs::read_to_string(&path)?,
        (mime::APPLICATION, "vnd.openxmlformats-officedocument.wordprocessingml.document") => {
            use docx::document::BodyContent;
            use docx::DocxFile;

            match DocxFile::from_file(&path) {
                Ok(f) => match f.parse() {
                    Ok(doc) => doc
                        .document
                        .body
                        .content
                        .iter()
                        .filter_map(|c| match c {
                            BodyContent::Paragraph(p) => Some(
                                p.iter_text()
                                    .map(|s| s.as_ref())
                                    .collect::<String>(),
                            ),
                            _ => None,
                        })
                        .collect::<Vec<_>>()
                        .join("\n"),
                    Err(_) => {
                        eprintln!("Failed to parse DOCX: {}", path.display());
                        String::new()
                    }
                },
                Err(_) => {
                    eprintln!("Failed to open DOCX: {}", path.display());
                    String::new()
                }
            }
        }
        _ => return Err(anyhow::anyhow!("Unsupported mime: {}", mime.essence_str())),
    };

    let chunks = chunk_text(&raw_text, 512)?;
    let total = chunks.len();
    for (i, chunk) in chunks.into_iter().enumerate() {
        let embedding = embeddings::embed(&chunk).await?;
        vector_db::upsert(
            &Uuid::new_v4().to_string(),
            embedding,
            json!({
                "text": chunk,
                "file_name": path.file_name().unwrap_or_default(),
                "mime": mime.essence_str(),
                "chunk_index": i,
                "total_chunks": total,
                "thread_id": thread_id,
            }),
        )
        .await?;
    }
    Ok(())
}
