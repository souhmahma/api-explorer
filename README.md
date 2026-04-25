# APIX — Visual API Explorer

A beautiful API explorer with a **FastAPI proxy backend** (to avoid CORS issues) and a **React frontend** with collapsible JSON tree, request history, and auth support.

---

## Project Structure

```
api-explorer/
├── backend/
│   ├── main.py          # FastAPI proxy server
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx      # Main app
    │   ├── App.css      # Styles
    │   ├── JsonTree.jsx # Collapsible JSON viewer
    │   ├── History.jsx  # Request history sidebar
    │   └── main.jsx     # Entry point
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Setup

### 1. Backend (FastAPI)

```bash
cd backend

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000  
Swagger docs at: http://localhost:8000/docs

---

### 2. Frontend (React + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: http://localhost:5173

---

## Features

- **Proxy all requests** through FastAPI — no CORS issues
- **Methods**: GET, POST, PUT, PATCH, DELETE
- **Auth**: Bearer token, API Key (custom header), Basic (Base64)
- **Custom headers** — add as many as you need
- **Request body** — JSON editor for POST/PUT/PATCH
- **Collapsible JSON tree** — auto-collapses deep objects, click to expand
- **Response metadata** — status code, response time (ms), response size
- **Response headers** — inspect all headers from the target API
- **Request history** — last 20 requests, click to reload

---

## How the Proxy Works

All requests from the frontend go to:

```
GET/POST http://localhost:8000/proxy?__url=<target-url>&__auth=<token>&__auth_type=Bearer
```

The FastAPI proxy:
1. Strips the internal `__url`, `__auth`, `__auth_type` params
2. Forwards the request to the real target URL
3. Returns a unified response with `status_code`, `headers`, `body`, `elapsed_ms`

---

## Example APIs to try

- `https://jsonplaceholder.typicode.com/posts` — fake REST API
- `https://httpbin.org/get` — inspect your own request
- `https://api.github.com/users/octocat` — GitHub public API
- `https://catfact.ninja/fact` — random cat facts
