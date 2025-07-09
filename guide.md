# Ollama Chat – Tauri Desktop Application

*A Codex-ready project blueprint*

---

## 1  Project Goal

Build a cross-platform **desktop chat client** (Windows / macOS / Linux) powered by **\[Tauri 2.0]**, talking to a locally-running **Ollama** daemon.
The app should **feel instantly familiar** to users of ChatGPT, Claude, or Gemini while giving power-users full control over:

| Feature              | Description                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Model picker**     | List every model exposed by `ollama list` (including user-imported GGUF/Modelfile builds) and set temperature, max-tokens, etc. ([medium.com][1])                      |
| **Tool picker**      | Toggle first-party tools (web search, file read/write, code-exec, etc.). Grey-out tools if the selected model lacks the required function-calling schema.              |
| **RAG mode**         | One-click Retrieval-Augmented Generation: automatically retrieve relevant chunks from a local **vector DB** and inject them into the prompt. ([rapidinnovation.io][2]) |
| **File attachments** | Drag-&-drop or attach files per message. The app parses, embeds, and stores them so future questions are answered from the new knowledge.                              |

---

## 2  Design Language & UX Guidelines

*Adopt proven patterns from popular AI UIs while staying native to each OS.*

1. **Three-pane layout** (sidebar + chat thread + context panel)
2. **Tabbed conversations** — unlimited tabs across the top bar à la Claude “Projects”.
3. **Syntax-highlighted Markdown** with copy buttons, collapsible sections, and inline latex.
4. **Adaptive theming**: dark/light and brand-accent (#fbcd14) tied to system setting.
5. **Progressive disclosure**: hide advanced model knobs under a collapsible “Advanced” drawer.
6. **Accessibility first** – keyboard navigation, screen-reader labels, and reduced-motion mode.

---

## 3  Functional Scope

| Area                    | Key Requirements                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Conversation Engine** | Streamed tokens with partial rendering; cancel & regen; per-message system prompts; conversation export (.md).                                              |
| **Model Management**    | Detect Ollama socket, list models, show disk size & quantization; “Download public model” wizard that calls `ollama pull llama3:8b`.                        |
| **Tooling Layer**       | Pluggable Rust traits (`Tool + Callable`) for search, file I/O, shell snippets, image generation; automatic function-calling if model supports JSON schema. |
| **RAG Pipeline**        | <br>1 Embed query (default `nomic-embed-text`); 2 `topK` search in **Qdrant** (embedded or external); 3 assemble context; 4 stream completion.              |
| **Vector DB Ops**       | Namespace per chat-thread; periodic compaction; export/import.                                                                                              |
| **File Flow**           | Attachment → MIME detect → text extractor (PDF, docx, code, images via OCR) → chunk & embed → store vectors + metadata.                                     |
| **Security**            | Enforce Tauri **command scopes**, **CSP**, and **capabilities**; no HTTP server; IPC only. ([v2.tauri.app][3], [v2.tauri.app][4])                           |

---

## 4  Architecture Overview

```mermaid
flowchart TB
    subgraph Frontend (React + TS)
        A[Chat UI] --> B[Tool Selector]
        A --> C[Markdown Renderer]
        A --> E[File DropZone]
    end
    subgraph Tauri Core (Rust)
        D[IPC Router] --> F[Ollama Client (ollama-rs)]
        D --> G[Tool Adapters]
        D --> H[RAG Service]
        H --> I[Vector DB (Qdrant)]
        G --> J[Web Search]
        G --> K[FS read/write]
    end
    F <--> |HTTP gRPC| L[(Ollama Daemon)]
```

### 4.1 Frontend

* **Framework**: React 18 + Vite + shadcn/ui
* **State**: Zustand store (`currentModel`, `tools`, `threads`)
* **Styling**: Tailwind, radix-themes, CodeMirror for editor blocks

### 4.2 Backend (Rust)

* `tauri-plugin-olllama.rs` – safe wrapper over Ollama REST
* `rag-worker` – async task runner (Tokio) for embedding + search
* `tools/` – each tool implements `async fn call(&self, args) -> ToolResult`
* `security.rs` – defines command scopes & permissions

---

## 5  Detailed Walk-through

1. **App start**

   * Probe `http://127.0.0.1:11434` → if missing, prompt installation link.
   * Load models → populate picker.
2. **New chat**

   * User types prompt (or drops files → pre-processing).
   * If **RAG** enabled → embed query → retrieve `topK` docs → build system + user prompt.
   * Send streamed request to Ollama with selected tool schema.
3. **Tool invocation**

   * Model returns `function_call` JSON → backend routes to matching Rust tool → result streamed back.
4. **Persist**

   * Store message & metadata in local SQLite; vectors in Qdrant.
5. **Attach-file reuse**

   * On later queries, the RAG service can surface snippets from any previously attached files.

---

## 6  AI “Frontend Tools” Prompt Template

```text
You have additional capabilities beyond plain text:
1. `code_block(language, code)` – render syntax-highlighted, copyable blocks.
2. `tab(title, content)` – create a new tab pane (use sparingly, max 5 per message).
3. `badge(color, text)` – inline colored badge for quick tags.
4. `collapse(title, content)` – collapsible detail sections.

When responding:
- Prefer concise Markdown with proper headings.
- Use tabs only when comparing alternatives or showing multi-file outputs.
- Never exceed 80 lines per code block without a collapse wrapper.
```

Codex can embed this template in every system prompt so the assistant knows exactly **how** and **when** to call enhanced UI features.

---

## 7  Development Environment

```bash
# Prerequisites
rustup install stable
npm i -g pnpm
# Clone & bootstrap
git clone https://github.com/your-org/ollama-chat-tauri.git
cd ollama-chat-tauri
pnpm i
cargo tauri dev          # starts Vite + Tauri
```

### Embedding & Vector DB

```bash
# Qdrant (embedded)
cargo install qdrant-embedded
# or run docker
docker run -p 6333:6333 qdrant/qdrant
```

---

## 8  Security & Compliance Checklist

* [x] Restrict **IPC commands** to whitelisted origins.
* [x] Disable Tauri *devtools* in prod builds.
* [x] CSP: default-src 'self'; connect-src 'self' [http://127.0.0.1:11434](http://127.0.0.1:11434).
* [x] Auto-update channel with signature validation.
* [x] Store secrets (search API keys) via Tauri’s encrypted keychain.

---

## 9  Stretch Goals

| Idea                                                                             | Benefit                                     |
| -------------------------------------------------------------------------------- | ------------------------------------------- |
| **Mobile build** (iOS / Android) via Tauri 2.0 mobile target ([v2.tauri.app][3]) | Seamless cross-device chat                  |
| **Collaborative mode**                                                           | Share threads over LAN websocket            |
| **Plugin SDK**                                                                   | Let community add new tools without forking |

---

## 10  Suggested Codex Tasks

1. **Scaffold Tauri project skeleton** (`cargo tauri init`, Vite + React template).
2. **Generate Rust wrapper for Ollama REST** + TypeScript bindings.
3. **Implement vector DB service** with `qdrant-client` (create, upsert, search).
4. **Produce React components**: `ChatPane`, `ModelSettingsDrawer`, `ToolToggleBar`, `AttachmentTile`.
5. **Write end-to-end tests** using Playwright (stream handling, tool calls).

---
