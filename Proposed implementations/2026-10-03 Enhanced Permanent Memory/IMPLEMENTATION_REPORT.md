# Enhanced Permanent Memory — Implementation Report

**Date:** 2026-10-03  
**Application:** Judge AI

## Summary
Judge AI now has a durable per-user memory layer that carries useful preferences, corrections, edits, notes, and review feedback into future draft generation.

This is separate from Judge Style. Judge Style learns writing style from historical judgments; Permanent Memory learns from ongoing user interaction.

## Architecture
Two database layers were added:

- `user_memory_events`: preserves the original learning event and provenance.
- `user_memory_items`: deduplicated memory used for retrieval.

Memory item scopes:
- `global`
- `case_type`
- `case`

Categories:
- `instruction`
- `preference`
- `edit_example`
- `author_note`
- `review_feedback`
- `manual`

Repeated identical memory increases `reinforcementCount` instead of creating endless duplicates.

## Automatic learning implemented
Judge AI records:
- manual draft paragraph edits;
- section author notes;
- accepted/addressed/deferred review findings;
- review context used for regeneration;
- explicit permanent instructions entered by the user.

Automatically learned edits/notes/review feedback are conservatively case-scoped so facts from one case do not silently become rules for another case.

## Retrieval
Before structured draft generation, the system retrieves active memories for:
1. current case;
2. matching case type;
3. user-global memory.

Up to 16 memories are selected, ordered by scope specificity, reinforcement, confidence, and recency.

After a successful generation, selected memories receive an incremented usage count and updated last-used timestamp.

## Prompt priority
Memory is advisory and the system prompt explicitly states:
- current case evidence and applicable law override memory;
- the judge's current explicit instruction overrides remembered preferences;
- remembered names, dates, amounts, or case facts are not evidence in another matter;
- edit examples are writing/structure examples only.

## User controls
New route: `/memory`

Users can:
- inspect learned memory;
- view active/total/event/use counts;
- add global or case-type permanent instructions;
- disable a memory without removing its historical event;
- reactivate a disabled memory.

## Persistence
Memory survives:
- application restart;
- browser refresh;
- program-data reset;
- settings reset;
- factory reset.

Case links use `ON DELETE SET NULL`, so historical memory remains even when a referenced case no longer exists.

## Database deployment
Added:
- `drizzle/0008_permanent_memory.sql`
- Drizzle definitions in `drizzle/schema.ts`
- migration journal entry
- startup schema compatibility repair in `server/schemaRepair.ts`

## Files added
- `server/memoryService.ts`
- `server/memoryService.test.ts`
- `client/src/pages/Memory.tsx`
- `drizzle/0008_permanent_memory.sql`

## Files modified
- `drizzle/schema.ts`
- `drizzle/meta/_journal.json`
- `server/schemaRepair.ts`
- `server/judgeAiService.ts`
- `server/judgeAiRouter.ts`
- `client/src/App.tsx`
- `client/src/pages/Home.tsx`

## Test coverage
`server/memoryService.test.ts` verifies:
- no memory block when no memories are relevant;
- memory remains subordinate to current evidence/instructions;
- edited text is marked as an example, not transferable case facts;
- case-type memory is labelled correctly.

## Important implementation note
This mechanism improves behavior through durable retrieval and reinforcement. It does not modify the underlying LLM weights. This preserves auditability, user isolation, reversibility, and predictable scoping.
