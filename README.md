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

Production values for the packaged Android app:

```bash
VITE_API_BASE_URL=https://api.tibayahome.com/api/v1
VITE_SOCKET_URL=https://api.tibayahome.com/realtime
```

## Development

```bash
npm run dev        # start Vite dev server
npm run lint       # eslint over src
npm run test       # vitest unit + component tests
npm run playwright # Playwright e2e (requires dev server running)
```

For Playwright, ensure the dev server is running (defaults to `http://localhost:5173`) or set `PLAYWRIGHT_BASE_URL`.

## Android Packaging With Capacitor

This project can be packaged as an Android APK without rebuilding it as a native app. Capacitor wraps the production `dist/` build in an Android WebView shell while the backend remains hosted at:

```bash
https://api.tibayahome.com/api/v1
```

Typical flow:

```bash
npm install
npx cap add android
npm run build
npm run cap:sync
npm run cap:open
```

Useful scripts:

```bash
npm run cap:assets
npm run cap:copy
npm run cap:sync
npm run cap:open
npm run android
```

Recommended MVP validation in Android:

- authentication and session resume
- booking flows
- Google Maps rendering
- geolocation permission prompts
- realtime socket updates
- push/notifications only if explicitly in scope

Detailed Android manifest, network security, app icon/splash, and push setup notes:

- [docs/android-packaging.md](./docs/android-packaging.md)

## Project Highlights

- React Router v6 with domain-specific route bundles and guards
- React Hook Form + Zod for validation, TanStack Query for server cache
- Axios with JWT interceptors and refresh mutex
- Tailwind for utility styling, MUI (tree-shaken) for complex widgets
- i18next scaffolding for English/Swahili, Socket.IO provider ready for realtime features
- Realtime notification center with field-filtered REST queries and live socket updates
