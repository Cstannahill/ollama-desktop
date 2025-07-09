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
