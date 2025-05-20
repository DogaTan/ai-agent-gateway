# AI Agent Chat Gateway (Backend)

This is a Node.js + Express backend that acts as a gateway between a React frontend and a Midterm Billing API. It uses Ollama + Mistral to analyze user messages and determine the correct intent and parameters.

## ✨ Features

- Intent extraction using Ollama + Mistral
- Routes user messages to correct Midterm API endpoints
- Formats dynamic responses in natural language
- `/login` endpoint to authenticate and fetch JWT token
- Supports query_bill, query_bill_detailed, make_payment, and bill_history intents

## 🔐 Auth Integration

- Frontend sends login request to `/login`.
- The backend forwards it to the Midterm API.
- Returned token is stored in the frontend and sent with each `/chat` request.
- The backend then passes the token in headers to the Midterm API.

## 🧠 Flow

1. User sends a message to `/chat`.
2. Ollama analyzes and returns intent and parameters.
3. The backend sends a corresponding request to the Midterm API using the user token.
4. A dynamic, user-friendly message is returned.

## 🌐 Environment Variables

`.env` file should include:

```env
PORT=3000
OLLAMA_API=http://localhost:11434/api/generate
```

Optionally, store your Midterm API token if manually testing.

## 📂 Key Files

```
index.js       # Main server file
.env           # Environment variables
```

## 🚀 Run the Server

```bash
npm install
node index.js
```

## 🔗 Technologies Used

- Node.js + Express
- Ollama + Mistral
- Axios
- dotenv
- JWT Authentication
- Midterm API

## 🔒 Note

**- Why Ollama + Mistral instead of OpenAI API?**
The OpenAI API has usage limitations in its free tier, and requires a stable internet connection and billing setup.
To avoid these limitations, this project uses Ollama, which is a local LLM runtime for running models like Mistral directly on your computer without external API calls or tokens.

**- About Ollama:**

Ollama runs entirely on your local machine.

It supports various open-source models including Mistral, Llama2, etc.

It provides a simple local API (http://localhost:11434) for inference.

For this project, Mistral is used to analyze user messages and extract intent + parameters.

**- Deployment Limitation Due to Ollama:**

Since Ollama is a local service, it cannot run directly on hosting platforms like Render, Vercel, or Netlify.

Therefore, even if this backend is deployed, it won’t be functional unless Ollama is also running locally on the same machine.

To deploy this project in production, you would need to:

Host Ollama on a VPS (Virtual Private Server) or

Replace Ollama with a cloud-based LLM like OpenAI or Cohere and update the API request logic.

### 🎥 Presentation Video

[📺 Watch the video here](https://drive.google.com/file/d/1LgFTzhip-IQkafnt3iItlVR-iBcV8Qyk/view?usp=drive_link)

## 🚀 Deployment

This project is deployed on [Render](https://render.com/)  
🔗 **Live URL Backend:** (https://ai-agent-gateway.onrender.com)

🔗 **Live URL Frontend:** (https://ai-agent-chat.onrender.com)

🔗 **Midterm API Swagger UI:** [`https://se4458-midterm-project.onrender.com/swagger-ui.html`](https://se4458-midterm-project.onrender.com/swagger-ui.html)
