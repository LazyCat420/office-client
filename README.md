# Office Client

Next.js frontend for visualizing and interacting with trading agents. Runs on **port 3035** and proxies API requests to backend services.

## Architecture

```
office-client:3035  ──→  trading-client:8888  (trading API)
                    ──→  trading-service:3031 (agent registry)
                    ──→  prism-service:7777   (data store)
                    ──→  tts-service:3032     (Piper TTS)
```

All proxying is handled via Next.js rewrites in `frontend/next.config.mjs`. The `defaultHost` is auto-detected from `vault-service/projects.json` (traverses parent directories), falling back to `10.0.0.16`.

## Tech Stack

- **Next.js 16** (standalone output mode)
- **React 19** + **Three.js** (3D agent visualization)
- **react-three-fiber** / **drei** / **rapier** (physics)
- **Lucide React** (icons)

## Setup

```bash
# Install dependencies
cd frontend && npm install

# Run dev server (port 3035)
npm run dev

# Or from root:
npm run dev
```

## Environment Variables

See [`.env.example`](./.env.example) for available overrides. Most configuration is auto-detected from `vault-service/projects.json`.

## Docker Deployment

```bash
# Build & deploy to Synology NAS
npm run deploy

# Dry run (validate without deploying)
npm run deploy -- --dry-run
```

The Dockerfile uses a multi-stage build (deps → build → runner) with a non-root user. Production runs the Next.js standalone server on port 3035.

## Project Structure

```
office-client/
├── frontend/           # Next.js app
│   ├── src/            # Pages, components, styles
│   ├── public/         # Static assets
│   └── next.config.mjs # Proxy rewrites & host config
├── Dockerfile          # Multi-stage production build
├── deploy.sh           # NAS deployment (uses deploy-kit)
└── docker-compose.yml  # Container orchestration
```
