# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev              # tsx watch on server/_core/index.ts (Express + Vite middleware in dev)
pnpm build            # scripts/build-client.mjs (Vite → dist/public) + scripts/build-server.mjs (ESBuild → dist/index.js)
pnpm build:cjs        # CommonJS bundle for pkg (dist/index.cjs)
pnpm start            # node dist/index.js (production server)
pnpm check            # tsc --noEmit (full project type-check)
pnpm format           # prettier --write .

# Database
pnpm db:push          # drizzle-kit generate && drizzle-kit migrate (no separate generate/studio scripts exist)

# Testing (vitest, config in vitest.config.ts; test patterns: server/**/*.{test,spec}.ts, client/src/**/*.{test,spec}.ts)
pnpm test                   # Run all tests
pnpm test -- <path>         # Run a single file
pnpm test -- -t "<name>"    # Run a single test by name

# Distribution (Windows x64 only)
pnpm build:installer  # electron-builder NSIS installer → release/
pnpm build:exe        # pkg-bundled standalone EXE → dist/exe/
pnpm dist:win         # scripts/build-win.mjs (full Windows distribution build)
```

Package manager is **pnpm** (not npm/yarn).

## Architecture

Full-stack TypeScript monorepo: React 19 frontend, Express + tRPC 11 backend, MariaDB/MySQL with Drizzle ORM, with an Electron wrapper for desktop deployment.

### Request Flow

Client → tRPC procedures (defined in [server/judgeAiRouter.ts](server/judgeAiRouter.ts)) → service functions ([server/judgeAiService.ts](server/judgeAiService.ts)) → DB layer ([server/db.ts](server/db.ts)) / LLM ([server/_core/llm.ts](server/_core/llm.ts))

### Key Files

- [server/judgeAiService.ts](server/judgeAiService.ts) — ~2800 lines, all core business logic: document ingestion, AI draft generation, review/quality assessment, DOCX export, audit logging
- [server/judgeAiRouter.ts](server/judgeAiRouter.ts) — tRPC route definitions for all API procedures
- [server/db.ts](server/db.ts) — Drizzle ORM data access layer (all queries here, not in service)
- [drizzle/schema.ts](drizzle/schema.ts) — Full database schema (entities, enums, constraints)
- [server/_core/index.ts](server/_core/index.ts) — Express app setup, middleware, port binding; **also seeds DeepSeek + Kimi provider keys on every startup** and upserts the `desktop-local-user` admin
- [server/routers.ts](server/routers.ts) — Top-level tRPC `appRouter` (mounts `system`, `auth`, `judgeAi`)
- [server/_core/llm.ts](server/_core/llm.ts) — LLM provider abstraction (OpenAI, Azure, Alibaba, Kimi, Deepseek, custom)
- [client/src/App.tsx](client/src/App.tsx) — Frontend root with Wouter routing and protected route logic
- [vite.config.ts](vite.config.ts) — Vite config with custom debug-logging plugin

### Database Schema (Drizzle)

Core entity relationships:
- `users` → `userSessions`, `cases`, `drafts`
- `cases` → `caseParties`, `caseDocuments`, `drafts`, `processingJobs`, `caseActivityLogs`
- `drafts` → `draftSections` → `draftParagraphs` → `paragraphAnnotations`
- `knowledgeDocuments` — standalone legal reference library (statutes, precedents)
- `aiProviderSettings` — per-user configurable LLM endpoints with encrypted API keys

### AI Drafting Pipeline

1. Case documents uploaded → `processingJobs` queue → text extracted (pdf-parse / mammoth for DOCX)
2. `generateStructuredDraft()` retrieves case context + knowledge base, calls LLM provider
3. Draft stored as 5 fixed sections: `header`, `facts`, `issues`, `reasoning`, `operative_part`
4. Each section has paragraphs; paragraphs have annotations referencing law/evidence/precedent
5. Judge reviews, edits inline, runs consistency check (`reviewCaseAgainstEvidence()`)
6. On approval, `exportDraftAsDocx()` generates the final decision file

### Auth & Desktop Mode

- Session-based with hashed tokens stored in `userSessions`; role is `judge` or `admin`
- tRPC context ([server/_core/context.ts](server/_core/context.ts)) hydrates `session` on every request
- `OWNER_OPEN_ID` env var enables **desktop mode**: auto-login as admin, bypasses normal auth
- Electron main process ([electron/main.cjs](electron/main.cjs)) sets `OWNER_OPEN_ID` and launches the Express server then a BrowserWindow

### Frontend Contexts

- `LocaleContext` — English/Greek i18n switching (translation keys in component files)
- `ThemeContext` — light/dark mode toggle
- `useAuth()` hook ([client/src/_core/](client/src/_core/)) — auth state, role checks, redirect logic

### tRPC Setup

- Server procedures defined with `publicProcedure` / `protectedProcedure` / `adminProcedure` in [server/_core/trpc.ts](server/_core/trpc.ts)
- Client initialized in [client/src/lib/trpc.ts](client/src/lib/trpc.ts) with React Query integration
- All mutation/query hooks on the client are generated automatically from the router type

## Environment Variables

Required in `.env`:
```
DATABASE_URL=mysql://...
JWT_SECRET=<min 32 chars>
NODE_ENV=development|production
PORT=3000
OWNER_OPEN_ID=<desktop admin user id>
FRONTEND_URL=http://localhost:5173
```

LLM provider keys stored encrypted in `aiProviderSettings` table, not in `.env`.

## Constraints

- File upload limit: 50 MB
- Rate limit: 120 req / 60s per IP
- Supported document types: PDF, DOCX, plain text
- Database: MariaDB 10.11+ or MySQL 8.0+ (uses `json` columns and window functions)
- Node.js: 22+
- Target platform for builds: Windows x64
