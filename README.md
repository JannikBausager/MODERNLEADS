# CRM Lite (MODERNLEADS) — Lead Management MVP

A chat-first lead management system for SMBs with Business Central integration.

## Quick Start

```bash
# Prerequisites: Node.js 24+, pnpm
pnpm install
pnpm dev          # starts API (port 3001) + Web (port 5173)
```

Then open **http://localhost:5173**

### Seed Demo Data

With the API running:
```bash
node --experimental-sqlite scripts/seed.mjs
```

Creates 8 sample leads across all pipeline stages with interactions.

## Architecture

```
├── apps/api          Express + node:sqlite backend (port 3001)
├── apps/web          Vite + TypeScript frontend (port 5173)
├── packages/shared   Zod schemas, DTOs, shared types
└── scripts/          Seed data, utilities
```

## Key Features

| Feature | Description |
|---------|-------------|
| **Lead Capture** | Create leads from web form, email, chatbot, or manual entry |
| **Pipeline Board** | Drag-and-drop kanban with stage validation |
| **Chat Agent** | Natural language commands: "show new leads", "convert lead X" |
| **Lead Enrichment** | Mock enrichment endpoint (structured for real API swap) |
| **Conversion** | Lead → Opportunity with BC adapter (mock or real MCP) |
| **BC Integration** | Connect to Business Central MCP server for Customers, Contracts, Opportunities |
| **Settings** | Configure BC MCP connection from the UI |

## Lead Lifecycle

```
New → Contacted → Qualified → Converted
                           → Disqualified → Contacted (re-engage)
```

## Chat Agent Commands

- `show new leads` — list leads with stage = New
- `list leads` — list all leads
- `show lead <id>` — detail view
- `prioritize my leads` — sorted by score
- `draft reply to lead <id>` — generate email template
- `enrich lead <id>` — enrich (requires confirmation)
- `move lead <id> to contacted` — stage change (requires confirmation)
- `convert lead <id>` — convert to opportunity (requires confirmation)

## Business Central MCP Integration

Navigate to **Settings** (⚙️) in the sidebar to configure:

| Setting | Default |
|---------|---------|
| Tenant | `DirectionsEmeaWorkshop1.onmicrosoft.com` |
| Environment | `PRODUCTION` |
| Company | `CRONUS USA, Inc.` |
| MCP Config | `MCPleads` |

The app connects to BC's native MCP server via Streamable HTTP. When MCP is not configured, mock data is used for Customers and Contracts.

**Capabilities via BC MCP:**
- Get Customers from BC
- Get Contracts from BC
- Create Opportunities in BC (on lead conversion)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/leads` | List leads (query: `stage`, `search`) |
| POST | `/api/leads` | Create lead |
| GET | `/api/leads/:id` | Get lead |
| PATCH | `/api/leads/:id` | Update lead |
| POST | `/api/leads/:id/stage` | Change stage |
| POST | `/api/leads/:id/enrich` | Enrich lead |
| POST | `/api/leads/:id/convert` | Convert to opportunity |
| GET | `/api/leads/prioritized` | Leads sorted by score |
| GET/POST | `/api/interactions` | List/create interactions |
| GET | `/api/opportunities` | List opportunities |
| POST | `/api/agent/chat` | Agent chat endpoint |
| GET/PUT | `/api/settings/bc` | BC MCP settings |
| POST | `/api/settings/bc/test` | Test BC connection |
| GET | `/api/bc/customers` | BC customers (MCP or mock) |
| GET | `/api/bc/contracts` | BC contracts (MCP or mock) |

## Commands

```bash
pnpm install    # install dependencies
pnpm dev        # run api + web in dev mode
pnpm build      # build all packages
pnpm test       # run all tests (26 passing)
pnpm lint       # lint all packages
```

## Assumptions

- SQLite for MVP storage (via Node.js built-in `node:sqlite`)
- BC MCP server follows the standard MCP Streamable HTTP transport
- Lead scoring is deterministic (stub) — designed for AI scoring swap
- Enrichment is a stub — structured for real enrichment API integration
- Authentication is simplified for MVP (bearer token for BC MCP)

## Tech Stack

- **Backend:** Node.js 24, Express, TypeScript, node:sqlite
- **Frontend:** Vite, TypeScript, vanilla CSS (no framework)
- **Validation:** Zod schemas (shared between frontend and backend)
- **Testing:** Vitest + Supertest (26 tests)
- **BC Integration:** @modelcontextprotocol/sdk (MCP client)
