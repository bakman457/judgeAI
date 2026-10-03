# Judge AI — Enhanced Permanent Memory
## Administrator Guide
**Implementation date:** 2026-10-03

## 1. Overview

Enhanced Permanent Memory is a server-side MySQL persistence mechanism used to retain judge feedback and retrieve relevant instructions during future draft generation.

The feature is per-user and does not depend on browser local storage.

## 2. Database objects

### user_memory_events

Append-oriented event history.

Key fields:

- `userId`
- `caseId`
- `caseType`
- `eventType`
- `rawText`
- `metadataJson`
- `createdAt`

Purpose: preserve the original learning signal for audit and future reprocessing.

### user_memory_items

Deduplicated retrieval layer.

Key fields:

- `userId`
- `scope`
- `caseId`
- `caseType`
- `category`
- `content`
- `fingerprint`
- `confidence`
- `reinforcementCount`
- `usageCount`
- `status`
- `sourceEventId`
- `lastUsedAt`

## 3. Migration

Primary migration:

`drizzle/0008_permanent_memory.sql`

It is registered in:

`drizzle/meta/_journal.json`

The Drizzle model is defined in:

`drizzle/schema.ts`

## 4. Startup compatibility

`server/schemaRepair.ts` calls `ensurePermanentMemoryTables()`.

This supports installations that launch against an existing Judge AI database without first running the latest migration manually.

The repair path uses `CREATE TABLE IF NOT EXISTS`.

## 5. Service layer

Core implementation:

`server/memoryService.ts`

Main operations:

- `recordMemorySignal()`
- `getRelevantMemories()`
- `buildMemoryPrompt()`
- `markMemoriesUsed()`
- `listUserMemories()`
- `listUserMemoryEvents()`
- `setUserMemoryStatus()`
- `getUserMemoryStats()`

## 6. Deduplication

A SHA-256 fingerprint is derived from:

- user ID;
- scope;
- scoped case/case type;
- category;
- normalized memory text.

Unique key:

`user_memory_items_user_fingerprint_unique (userId, fingerprint)`

When the same item is learned again:

- no duplicate active item is created;
- `reinforcementCount` increases;
- confidence keeps the highest value;
- item returns to active status;
- source event pointer is updated.

The raw event is still separately retained.

## 7. Retrieval

Draft generation calls `getRelevantMemories()`.

Default maximum: 16 items per draft generation.

Selection includes:

- global user memory;
- current case-type memory;
- current-case memory.

Ordering:

1. case scope;
2. case-type scope;
3. global scope;
4. reinforcement count;
5. confidence;
6. latest update.

## 8. Reset semantics

Do not add memory tables to `resetSystemData()` unless retention policy is deliberately changed.

Current behavior:

- factory reset: memory retained;
- program-data reset: memory retained;
- settings reset: memory retained.

Because `caseId` uses `ON DELETE SET NULL`, case deletion does not destroy memory history.

Because `userId` uses `ON DELETE CASCADE`, deleting the owning user removes that user's memory.

## 9. UI/API

UI route:

`/memory`

tRPC namespace:

`judgeAi.memory`

Endpoints:

- `list`
- `events`
- `stats`
- `add`
- `setStatus`

Users can only read/update their own memory through the service API.

Case-scoped manual memory requires normal case-access authorization.

## 10. Security and legal safeguards

Memory is inserted as advisory context.

The prompt explicitly establishes:

- law/evidence > memory;
- current explicit instruction > remembered preference;
- remembered facts are not evidence in another case;
- edit examples are writing/structure guidance only.

Memory does not bypass the existing uploaded-document prompt-injection isolation.

## 11. Monitoring

Useful indicators from the Permanent Memory page/API:

- total items;
- active items;
- inactive items;
- superseded items;
- raw event count;
- reinforcement total;
- memory-use total.

For deeper operational review, query memory rows by `userId`, `status`, and `updatedAt`.

## 12. Backup and disaster recovery

Back up both memory tables together with the main Judge AI MySQL database.

For complete provenance, do not back up only `user_memory_items`; retain `user_memory_events` as well.

Recommended restore order when restoring manually:

1. users;
2. cases, if available;
3. user_memory_events;
4. user_memory_items.

## 13. Privacy considerations

Memory can contain judge-entered text and case-derived material.

Apply the same database access controls, encryption-at-rest, backup protection, and retention governance used for Judge AI case data.

Do not expose another user's memory in admin UI unless an explicit organizational policy and access-control design is introduced.

## 14. Troubleshooting

### Memory page shows database errors

Confirm `DATABASE_URL` is configured and that startup schema repair completed successfully.

Look for log entry:

`[SchemaRepair] Ensuring permanent memory tables`

### Memory is not being applied

Verify:

- item status is `active`;
- memory belongs to the same user;
- case-type spelling matches exactly for `case_type` scope;
- case ID matches for `case` scope.

### Memory duplicates appear

Confirm the unique key exists:

`user_memory_items_user_fingerprint_unique`

### A disabled item becomes active again

Repeated matching feedback is intentionally treated as reinforcement. The upsert path reactivates the matching item. If stricter behavior is desired later, add a user-pinned disabled flag separate from derived status.

## 15. Validation

Focused unit test:

`server/memoryService.test.ts`

It checks the prompt priority/safety contract and cross-case edit-example warning.

Recommended deployment validation:

1. start Judge AI;
2. confirm schema repair succeeds;
3. add a global memory in `/memory`;
4. generate a draft;
5. confirm its `usageCount` increments;
6. disable it;
7. generate again and verify it is no longer selected;
8. restart the application and verify the memory remains;
9. run a program-data reset and verify memory remains.
