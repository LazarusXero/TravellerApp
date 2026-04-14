---
name: Nexus Command Project Setup
description: Full-stack web app structure, stack choices, and key architectural decisions for the Nexus Command project
type: project
---

Full-stack app "Nexus Command" scaffolded at `C:\Users\lazar\Documents\TravellerApp`.

**Stack:**
- Backend: Node.js + Express + TypeScript + Prisma (SQLite) on port 3000
- Frontend: React + TypeScript + Vite + Tailwind CSS + React Router on port 5173
- Root orchestration: `concurrently` via `npm run dev`

**Key paths:**
- Server entry: `server/src/index.ts`
- Prisma schema: `server/prisma/schema.prisma`
- SQLite DB: `server/prisma/dev.db`
- Client entry: `client/src/main.tsx`
- Root .env: `.env` (DATABASE_URL="file:./dev.db", resolved relative to schema.prisma)

**Why:** The server's `dotenv` is configured to load from `../. env` (root) since `npm run server` sets CWD to the `/server` directory.

**How to apply:** When adding new API routes, add them under `server/src/routes/` and register in `server/src/routes/index.ts`. When adding new pages, add to `client/src/pages/` and register in `client/src/App.tsx`.
