# Judge AI MCP + HTTP Connectivity — User Guide

Date: 2026-10-03

## Start

Start Judge AI normally.

The local integration bridge starts with the application unless disabled.

Default addresses:

- HTTP: `http://127.0.0.1:3100/api/v1`
- MCP: `http://127.0.0.1:3100/mcp`
- Health: `http://127.0.0.1:3100/health`

## HTTP examples

List cases:

```
GET /api/v1/cases
```

Open one case:

```
GET /api/v1/cases/123
```

Read the current structured draft:

```
GET /api/v1/cases/123/draft
```

Search a case:

```
GET /api/v1/cases/123/search?q=inheritance
```

Read a case document:

```
GET /api/v1/cases/123/documents/456
```

Large documents are returned in bounded chunks. Use the returned `nextOffset` value to continue reading.

## MCP tools

Available tools include:

- list accessible cases;
- get a case overview;
- get the current draft;
- read a case document;
- read a knowledge document;
- search within a case;
- search across accessible cases;
- check generation status.

Example natural-language requests after connecting an MCP client:

- "List the Judge AI cases I can access."
- "Open case 123 and summarize the current draft."
- "Search case 123 for testament validity."
- "Read document 456 from case 123 and continue if it is truncated."

## Remote use

The bridge itself is local-only. If an MCP client runs outside the Judge AI computer, publish the local MCP endpoint through an approved secure gateway or tunnel.

## Read-only design

The external bridge is intentionally read-only.

Use the normal Judge AI application for generation, review, editing, approval, exports, and other state-changing judicial actions.
