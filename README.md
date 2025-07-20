# Ollama Desktop

A modern desktop application for chatting with Ollama models, featuring project organization, file ingestion, RAG (Retrieval-Augmented Generation), and an extensible tool system.

## Overview

Ollama Desktop is a Tauri-based application that provides a rich chat interface for Ollama models with advanced features:

- **Chat Management**: Create, organize, and manage multiple chat sessions
- **Project Organization**: Group chats and files into projects for better workflow organization
- **File Ingestion & RAG**: Upload documents (PDF, DOCX, TXT, MD) and have AI reference them in conversations
- **Tool System**: Extensible AI tools including web search, file operations, and shell commands
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS with dark/light theme support
- **Cross-Platform**: Runs on Windows, macOS, and Linux

## Features

### Core Chat Features
- Real-time streaming responses from Ollama
- Multiple model support (automatically detects available models)
- Message history persistence
- Copy message content functionality
- Skeleton loading states during generation

### Project Management
- Create and organize projects with descriptions
- Attach files to projects for context
- Group related chats within projects
- Project-based file organization

### File Ingestion & RAG
- Drag-and-drop file uploads
- Supported formats: PDF, DOCX, TXT, MD
- Automatic text extraction and chunking
- Vector database storage with Qdrant
- AI can reference uploaded content in responses

### Tool System
The application includes several built-in tools that AI can use:

- **Web Search**: Query DuckDuckGo for real-time information
- **File Read**: Read text files from the workspace
- **File Write**: Create and edit text files
- **Shell Exec**: Execute safe, read-only shell commands

### Additional Features
- **Theme Support**: Light and dark mode toggle
- **Command Palette**: Quick navigation and actions
- **Keyboard Shortcuts**: Efficient navigation
- **Audit Logging**: Track tool usage and permissions
- **Settings Dialog**: Configure models and tool permissions

## Requirements

### System Requirements
- **Ollama**: Local Ollama installation running on `http://127.0.0.1:11434`
- **Node.js**: Version 18+ with pnpm package manager
- **Rust**: Latest stable version for Tauri development

### For RAG Features
- **Qdrant Vector Database**: Running locally on `127.0.0.1:6333`
- **Embedding Model**: Ollama model `nomic-embed-text` installed

## Installation & Setup

### 1. Prerequisites

Install Ollama:
```bash
# Install Ollama (visit https://ollama.ai for platform-specific instructions)
# Start the Ollama service
ollama serve
```

For RAG functionality, install Qdrant:
```bash
# Using Docker
docker run -p 6333:6333 qdrant/qdrant

# Or install Qdrant locally (see https://qdrant.tech/documentation/quick_start/)
```

Install the embedding model:
```bash
ollama pull nomic-embed-text
```

### 2. Application Setup

Clone and install dependencies:
```bash
git clone <repository-url>
cd ollama-desktop
pnpm install
```

### 3. Development

Run in development mode:
```bash
pnpm tauri dev
```

### 4. Building for Production

Build the application:
```bash
pnpm build
pnpm tauri build
```

## Usage

### Basic Chat
1. Launch the application
2. Select a model from the dropdown
3. Start typing your message in the input field
4. Press Enter or click Send to generate a response

### Working with Projects
1. Click the "+" button to create a new project
2. Give it a name and optional description
3. Attach files by dragging them into the file drop zone
4. Create chats within the project context

### File Upload & RAG
1. Drag supported files (PDF, DOCX, TXT, MD) into the drop zone
2. Wait for processing (files are chunked and embedded)
3. Ask questions about the uploaded content
4. The AI will reference relevant sections automatically

### Using Tools
1. Open Settings → Tools
2. Enable desired tools (web_search, file_read, file_write, shell_exec)
3. The AI can now use these tools during conversations
4. Tool usage is logged in the audit system

### Keyboard Shortcuts
- `Cmd/Ctrl + K`: Open command palette
- `Cmd/Ctrl + N`: New chat
- `Cmd/Ctrl + ,`: Open settings
- `Enter`: Send message
- `Shift + Enter`: New line in message

## Configuration

### Data Storage
Application data is stored in:
- **Linux**: `~/.local/share/ollama-desktop/`
- **macOS**: `~/Library/Application Support/ollama-desktop/`
- **Windows**: `%APPDATA%/ollama-desktop/`

### Workspace Directory
Tools operate within a configurable workspace directory for security.

## Architecture

### Frontend (React/TypeScript)
- **State Management**: Zustand for chat and project state
- **UI Components**: Radix UI primitives with custom styling
- **Styling**: Tailwind CSS with CSS-in-JS for dynamic theming
- **Build Tool**: Vite with TypeScript support

### Backend (Rust/Tauri)
- **Core Framework**: Tauri 2.x for cross-platform desktop functionality
- **HTTP Client**: reqwest for Ollama API communication
- **Vector Database**: Qdrant client for RAG functionality
- **File Processing**: PDF extraction, DOCX parsing, text chunking
- **Tool System**: Trait-based extensible tool architecture

### Key Components
- **Chat Store**: Manages conversation state and history
- **Project Store**: Handles project organization and file attachments
- **Tool Registry**: Extensible system for AI-callable functions
- **RAG System**: Document processing and retrieval pipeline

## Development

### Project Structure
```
├── src/                    # React frontend
│   ├── components/        # UI components
│   ├── stores/           # Zustand state management
│   ├── hooks/            # Custom React hooks
│   └── pages/            # Application pages
├── src-tauri/            # Rust backend
│   ├── src/              # Rust source code
│   │   ├── tool.rs       # Tool system
│   │   ├── rag.rs        # RAG implementation
│   │   ├── ollama_client.rs # Ollama integration
│   │   └── ...
│   └── Cargo.toml        # Rust dependencies
└── package.json          # Node.js dependencies
```

### Adding New Tools
1. Create a new tool struct implementing the `Tool` trait:
```rust
pub struct MyTool;

#[async_trait]
impl Tool for MyTool {
    fn name(&self) -> &'static str { "my_tool" }
    fn description(&self) -> &'static str { "Description of what it does" }
    fn json_schema(&self) -> Value { /* JSON schema */ }
    async fn call(&self, window: &Window, args: Value) -> Result<String> {
        // Implementation
    }
}
```

2. Register in `tool.rs`:
```rust
map.insert("my_tool", Arc::new(MyTool));
```

### Testing
Run the test suite:
```bash
pnpm test          # Frontend tests
cargo test         # Backend tests (in src-tauri/)
```

## Known Issues

1. **Test Warnings**: Some React Testing Library warnings about `act()` wrapping (non-breaking)
2. **Bundle Size**: Frontend bundle is large (>1MB) - consider code splitting for optimization
3. **Future Compatibility**: `docx` crate has future Rust compatibility warnings

## Contributing

1. Follow existing code style and conventions
2. Add tests for new features
3. Update documentation for significant changes
4. Ensure both frontend and backend builds pass

## License

[Add your license information here]

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)