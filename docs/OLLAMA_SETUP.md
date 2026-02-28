# Ollama Setup for Vibe Coding with Continue

This project is configured to use [Ollama](https://ollama.com/) for AI-assisted coding with the Continue extension. Follow these steps to get started.

## 1. Install Ollama

If you haven't already, download and install Ollama from [ollama.com/download](https://ollama.com/download).

## 2. Pull Required Models

Open your terminal and run the following commands to download the models configured in `.continue/config.json`:

```bash
# Main coding model (recommended)
ollama pull deepseek-coder:6.7b

# Alternative general model
ollama pull llama3

# Alternative coding model
ollama pull qwen2.5-coder:7b

# Autocomplete model (lightweight)
ollama pull starcoder2:3b
```

## 3. Verify Setup

1. Start the Ollama server (usually runs in the background after installation).
2. Open the Continue extension in your IDE.
3. Select "DeepSeek Coder 6.7b" or another model from the dropdown.
4. Try asking a question or use `Cmd+I` (or `Ctrl+I`) to edit code.

## 4. Custom Commands

This configuration includes several custom commands accessible via slash commands:

- `/test`: Generate unit tests for selected code.
- `/refactor`: Refactor selected code for better readability and efficiency.
- `/explain`: Get a detailed explanation of the code.
- `/doc`: Generate JSDoc/TSDoc documentation.

## Troubleshooting

- **Connection Refused**: Ensure Ollama is running (`ollama serve`).
- **Slow Performance**: Try a smaller model like `deepseek-coder:1.3b` or `qwen2.5-coder:1.5b` if your machine has limited RAM/GPU. Update `.continue/config.json` accordingly.
