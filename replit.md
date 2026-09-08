# Steepbridge

Steepbridge is a static two-shop tea order and inventory handoff app backed by Firebase Realtime Database.

## Run & Operate

- `pnpm --filter @workspace/shop-bridge run dev` — run the static frontend
- `pnpm --filter @workspace/shop-bridge run typecheck` — check the frontend
- `pnpm --filter @workspace/shop-bridge run build` — create the static build
- Add Firebase Web SDK values as `VITE_FIREBASE_*` environment variables to enable shared live data.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TypeScript
- Shared data: Firebase Realtime Database client SDK
- Alerts: Web Speech API (`ta-IN`) plus Web Audio API beep
- Hosting: any static host, including Firebase Hosting or Replit static publishing

## Where things live

- `artifacts/shop-bridge/src/App.tsx` — Shop 1, Shop 2, and Firebase setup screens
- `artifacts/shop-bridge/src/hooks/use-shop-data.ts` — shared data listeners, demo mode, and mutations
- `artifacts/shop-bridge/src/hooks/use-tamil-alerts.ts` — Tamil voice and beep notification loops
- `artifacts/shop-bridge/src/lib/firebase.ts` — Firebase initialization and Realtime Database writes

## Architecture decisions

- Firebase configuration is read from `VITE_FIREBASE_*` values so the same static build can be connected to a shop-owned Firebase project.
- When Firebase is not configured, the app uses a local demo store and clearly labels the workspace as demo mode.
- Order confirmation deducts stock on the client with a Realtime Database transaction before marking the order confirmed.

## Product

- Shop 1 creates tea requests, sees status changes, acknowledges delivery, and reads current stock.
- Shop 2 confirms requests, edits thresholds, restocks items, and sees shared histories.
- Pending orders, missed acknowledgements, and low stock can announce in Tamil with repeatable beep and voice alerts.

## User preferences

- Keep the app frontend-only; Firebase is the shared data layer and no custom server is required.

## Gotchas

- Browser audio may require one tap on “Enable sound alerts” before voice and beep notifications can play.
- Firebase Realtime Database rules must be configured in the user’s Firebase project before sharing the app publicly.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
