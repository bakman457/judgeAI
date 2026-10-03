# Admin Guide — Controlled Decision Regeneration

**Date:** 2026-10-03  
**Feature:** Controlled Decision Regeneration

## 1. Overview

Controlled Decision Regeneration extends the existing `judgeAi.drafts.generate` workflow. It does not introduce a second drafting pipeline or a new database table.

The feature reuses:

- the existing processing-job system;
- the existing structured five-section draft model;
- existing draft version numbering;
- existing provider configuration;
- existing audit logging;
- existing workspace access controls.

## 2. No database migration required

The application already stores:

- `drafts.versionNo`
- `generationPromptSnapshot`
- `generatedByJobId`
- draft sections and paragraphs
- activity logs
- processing-job JSON payloads

The feature therefore requires no schema migration.

## 3. New generation request fields

The tRPC `judgeAi.drafts.generate` request supports:

```ts
{
  caseId: number;
  providerId?: number | null;
  profileId?: number | null;
  reviewContext?: string | null;
  customInstructions?: string | null;
  rewriteSections?: (
    | "header"
    | "facts"
    | "issues"
    | "reasoning"
    | "operative_part"
  )[] | null;
  sourceDraftId?: number | null;
}
```

## 4. Validation

Server-side validation includes:

- positive integer case ID;
- optional positive provider/profile/source draft IDs;
- max 12,000 characters for custom instructions;
- max 20,000 characters for review context;
- 1–5 values in `rewriteSections`;
- allowed section enum only;
- baseline draft must belong to the same case.

Do not rely on frontend validation alone.

## 5. Regeneration flow

1. User selects baseline draft and rewrite scope.
2. API verifies case access.
3. Service loads the case workspace.
4. Service loads/validates the selected baseline.
5. Processing job is created.
6. Legal knowledge context is retrieved.
7. Prompt includes baseline, requested scope, and judge instructions.
8. Provider generates the standard five-section JSON result.
9. Output is normalized.
10. `applyRegenerationScope()` restores locked sections from the baseline.
11. A new version is saved through `createDraftWithSections()`.
12. Job result and case activity are updated.

## 6. Audit fields

Inspect `processing_jobs.payloadJson` for:

- `sourceDraftId`
- `sourceVersionNo`
- `rewriteSections`
- `customInstructions`
- `reviewContext`
- provider/profile metadata

Inspect the `draft.generated` activity log for the same regeneration context.

The persisted draft's `generationPromptSnapshot` contains the actual user prompt sent for the saved generation.

## 7. Provider behavior

No provider-specific changes are required.

The feature works through the existing provider abstraction and failover chain.

Existing configured providers continue to receive the standard structured output schema.

## 8. Draft-history exposure

`getCaseWorkspace()` now returns `draftHistory`, backed by `listDraftVersionsForCase()`.

The current limit is 25 versions in normal workspace use.

The list contains draft metadata, not the complete content of every old draft. Full baseline content is loaded server-side only when regeneration is requested.

## 9. Operational troubleshooting

### Regeneration fails with baseline error

Confirm the selected `sourceDraftId` belongs to the current case.

### Section-scoped regeneration cannot start

A baseline draft is required when `rewriteSections` is supplied.

### User says a locked section changed

Compare the selected baseline version with the new draft at the structured section/paragraph level.

The backend should replace every non-selected generated section with baseline content before saving. If a difference is found, inspect `applyRegenerationScope()` and the input `rewriteSections`.

### Generation fails at the provider

Use the existing processing-job error and provider logs. The feature does not change the provider failover mechanism.

### Old version cannot be selected

The workspace returns the most recent 25 draft versions. If deeper history is required, increase the `listDraftVersionsForCase()` limit or add a dedicated paginated history endpoint.

## 10. Recommended validation after deployment

Run:

```bash
pnpm check
pnpm test
pnpm build
```

Then perform a functional smoke test:

1. Generate version 1.
2. Regenerate all sections with a simple instruction; confirm version 2.
3. Regenerate only Reasoning from version 2.
4. Confirm version 3 has new Reasoning but identical other section content.
5. Select version 1 as baseline and regenerate only Operative Part.
6. Confirm version 4 inherits locked sections from version 1, not version 3.
7. Run legal consistency review.
8. Use **New Generation** and verify findings appear in the instruction textbox without immediately triggering the model.
9. Check processing-job and case-activity audit metadata.

## 11. Permissions

The feature uses the existing protected draft route and existing `assertCaseAccess()` authorization.

No new admin permission is introduced.

## 12. Rollback

Because there is no database migration, rollback is code-only.

Reverting the feature commits restores the original generation UI/API behavior while leaving already-created draft versions valid in the existing schema.
