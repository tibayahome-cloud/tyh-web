# Tiba Ya Home – Web

Modular React + TypeScript front-end for Tiba Ya Home, covering client, provider, and admin authentication with shared UI and infrastructure utilities.

## Getting Started

```bash
npm install
```

Create an `.env` (or `.env.local`) file with the API base URL:

```bash
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

Optional socket configuration:

```bash
VITE_SOCKET_URL=http://localhost:6001
```

## Development

```bash
npm run dev        # start Vite dev server
npm run lint       # eslint over src
npm run test       # vitest unit + component tests
npm run playwright # Playwright e2e (requires dev server running)
```

For Playwright, ensure the dev server is running (defaults to `http://localhost:5173`) or set `PLAYWRIGHT_BASE_URL`.

## Project Highlights

- React Router v6 with domain-specific route bundles and guards
- React Hook Form + Zod for validation, TanStack Query for server cache
- Axios with JWT interceptors and refresh mutex
- Tailwind for utility styling, MUI (tree-shaken) for complex widgets
- i18next scaffolding for English/Swahili, Socket.IO provider ready for realtime features
- Realtime notification center with field-filtered REST queries and live socket updates
