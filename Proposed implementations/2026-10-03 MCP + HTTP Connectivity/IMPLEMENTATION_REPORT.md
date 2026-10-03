# Judge AI — MCP + HTTP Connectivity Implementation Report

Date: 2026-10-03

## Implemented

Judge AI now includes a dedicated external integration layer supporting:

- conventional HTTP/JSON access;
- MCP access for compatible clients;
- MCP 2026-07-28 discovery;
- legacy MCP initialization compatibility;
- a dedicated local integration server on 127.0.0.1:3100;
- read-only external tools that reuse Judge AI case-access rules.

## Main files

- server/integration/service.ts
- server/integration/http.ts
- server/integration/mcp.ts
- server/integration/server.ts
- server/integration/standalone.ts
- server/_core/index.ts
- .env.example

## HTTP

Base URL:

`http://127.0.0.1:3100/api/v1`

Implemented reads include case listing, case overview, current draft, generation status, document retrieval, and search.

## MCP

Endpoint:

`http://127.0.0.1:3100/mcp`

Read-only tools:

- judge_ai_list_cases
- judge_ai_get_case
- judge_ai_get_current_draft
- judge_ai_get_case_document
- judge_ai_get_knowledge_document
- judge_ai_search_case
- judge_ai_search_cases
- judge_ai_generation_status

## Configuration

```env
JUDGE_AI_INTEGRATION_ENABLED=1
JUDGE_AI_INTEGRATION_PORT=3100
JUDGE_AI_INTEGRATION_OPEN_ID=
```

## Security posture

The integration process binds to localhost only. State-changing judicial functions remain in Judge AI's authenticated application workflow.

## Validation

The cloud repository copy was statically reviewed. A local build could not be executed in this session because the user's local workspace connection was unavailable and the isolated runtime has no package-network access.

Before production merge, run:

```
npm run check
npm test
npm run build
```
