# Lead Copilot (BC Leads) — Claude Code Instructions

## Goal
Build an MVP lead management system for SMBs:
- Business Central is the system-of-record (mock via API contract for MVP).
- New web UI: chat-first + pipeline visualization.
- Lead lifecycle: New → Contacted → Qualified → Disqualified → Converted.
- Conversion creates an Opportunity record mapped from Lead fields.

## Tech Stack
- Backend: Node.js + TypeScript (Express or Fastify)
- DB: SQLite (Prisma or better-sqlite3 ok)
- Frontend: Vite + TypeScript (minimal UI)
- Tests: Vitest/Jest + Supertest (API tests)

## Non-negotiables
- Prefer small, incremental diffs.
- Add/maintain tests for core flows (create lead, stage change, convert).
- Before declaring a task "done", run tests and fix failures.
- State-changing actions from the agent MUST require confirmation.

## Repo Conventions
- /apps/api        backend service
- /apps/web        frontend
- /packages/shared shared types (zod schemas, DTOs)
- Use zod for request validation where possible.
- Every endpoint returns consistent error shape: { error: { code, message, details? } }

## Commands
- pnpm install
- pnpm dev (runs api + web)
- pnpm test
- pnpm lint

## Notes
- Business Central is mocked by an adapter module in /apps/api/src/bcAdapter/*
- Conversion mapping rules live in /apps/api/src/conversion/mapping.ts and must be unit-tested.
