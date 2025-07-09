use tiktoken_rs::get_bpe_from_model;

pub fn chunk_text(text: &str, max_tokens: usize) -> anyhow::Result<Vec<String>> {
    let enc = get_bpe_from_model("gpt-3.5-turbo")?;
    let mut out = Vec::new();
    let mut current = String::new();

    for line in text.lines() {
        if enc
            .encode_with_special_tokens(&(current.clone() + line))
            .len()
            > max_tokens
        {
            out.push(current.trim().to_owned());
            current.clear();
        }
        current.push_str(line);
        current.push('\n');
    }
    if !current.trim().is_empty() {
        out.push(current.trim().to_owned());
    }
    Ok(out)
}
