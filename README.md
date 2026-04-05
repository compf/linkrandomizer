# Minimal Electron + Angular monorepo

This workspace contains a tiny example where both the Electron `main` package and the `frontend` Angular app call a shared method in the `common` package.

Packages:
- `packages/common` — exports `MyType` and `myFunction`. Build with `npm run build`.
- `packages/frontend` — minimal Angular app that calls `myFunction` at startup. Build with `npm run build`.
- `packages/main` — Electron main process that calls `myFunction` and loads the frontend HTML. Start with `npm run start`.

Quick start (from workspace root):

1. Install dependencies in each package:
   - `cd packages/common && npm install`
   - `cd ../frontend && npm install`
   - `cd ../main && npm install`

2. Build and run:
   - `cd packages/frontend && npm run build` (creates `packages/frontend/dist`)
   - `cd ../common && npm run build` (creates `packages/common/dist`)
   - `cd ../main && npm run start` (this builds main then launches Electron)

Notes:
- The Electron main process expects `packages/frontend/dist/index.html` to exist (the frontend build copies it to `dist`).
- If you want, I can run `npm install` and a build locally now and try launching Electron—say the word and I'll proceed.
