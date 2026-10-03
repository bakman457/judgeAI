# Judge AI MCP + HTTP Connectivity — Administrator Guide

Date: 2026-10-03

## Environment

```env
JUDGE_AI_INTEGRATION_ENABLED=1
JUDGE_AI_INTEGRATION_PORT=3100
JUDGE_AI_INTEGRATION_OPEN_ID=
```

The bridge listens locally on `127.0.0.1`.

Default addresses:

- HTTP: `http://127.0.0.1:3100/api/v1`
- MCP: `http://127.0.0.1:3100/mcp`

## Identity

`JUDGE_AI_INTEGRATION_OPEN_ID` selects the Judge AI identity used for case visibility. When empty, `OWNER_OPEN_ID` is used.

Knowledge-document reads require an admin integration identity.

## MCP compatibility

Supported versions:

- 2026-07-28
- 2025-11-25
- 2025-06-18

Modern clients can use `server/discover`. Older compatible clients can use `initialize`.

## External permissions

The external MCP/HTTP surface is read-only.

Generation, review, editing, approval, exports, and administrative mutations stay inside Judge AI's existing authenticated application workflows.

## Validation

Run before production use:

```
npm run check
npm test
npm run build
```

Then verify:

```powershell
Invoke-RestMethod http://127.0.0.1:3100/health
Invoke-RestMethod http://127.0.0.1:3100/api/v1/cases
```

## Troubleshooting

If port 3100 is occupied, choose another value for `JUDGE_AI_INTEGRATION_PORT`.

If cases are missing, verify the configured integration user's Judge AI permissions.

To disable the bridge:

```env
JUDGE_AI_INTEGRATION_ENABLED=0
```
