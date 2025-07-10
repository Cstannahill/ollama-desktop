# Ollama Desktop Chat

Simple Tauri + React client that streams responses from a local Ollama daemon.

## Usage

1. Install dependencies

   ```bash
   pnpm install
   ```

2. Start the Ollama daemon

   ```bash
   ollama serve
   ```

3. Run the app

   ```bash
   pnpm tauri dev
   ```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## File ingest requirements

- Ollama embedding model `nomic-embed-text` must be available.
- Qdrant running locally on `127.0.0.1:6333`.
- Supported MIME types: PDF, plain text, Markdown, DOCX.

### Example

1. Drag a PDF into the drop zone.
2. Wait for the "parsed" status.
3. Send a message and future queries can reference the file.

## Tool system

Tools let the assistant perform external actions. Each tool implements the `Tool` trait on the Rust side and is registered in `tool::registry()`. The frontend lists available tools via the `list_tools` command and you can enable them per chat.

### Adding a tool

1. Create a struct that implements `Tool`.
2. Insert it into the registry in `tool.rs`.
3. Optional: expose new IPC commands if needed.

### Web Search

This build includes a `web_search` tool that queries DuckDuckGo's Instant Answer API (no key required) and returns up to five results. All requests comply with DuckDuckGo's terms of service.

## Tuning Retrieval Weights

Each attachment has an Importance slider (0.0–2.0). Adjusting it updates search scoring in Qdrant. Thread settings let you change Top K results and context token limits. Settings persist per thread.
\n// TODO: project-level export/import (zip workspace + threads)
