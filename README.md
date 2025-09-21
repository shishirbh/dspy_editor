# DSPy Editor Chat Frontend

This repository contains a TypeScript single-page application scaffolded with Vite and React that provides a chat interface for the DSPy editor backend.

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

The development server starts on [http://localhost:5173](http://localhost:5173) and proxies API requests directly to the backend (configure your backend to listen on the same origin or adjust the fetch URLs in `src/App.tsx`).

## Building for Production

```bash
cd frontend
npm run build
```

The build output is emitted to `frontend/dist` and can be served with any static file server. To preview the production build locally, run `npm run preview` after building.

## API Contracts

- `POST /generate_response` — accepts `{ "prompt": string }` and returns either a streamed body or JSON payload containing the assistant reply. The response may include an `X-Turn-Id` header or a `turn_id` field in the JSON body.
- `POST /save_edit` — accepts `{ "turn_id": string, "content": string }` and returns the persisted content (optionally in a JSON `{ "response": string }` shape).

Errors returned from either endpoint are surfaced in the UI so the user can retry.
