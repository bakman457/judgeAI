# Implementation Report — Controlled Decision Regeneration

**Date:** 2026-10-03  
**Feature:** Controlled Decision Regeneration with Judge Instructions  
**Repository:** bakman457/judgeAI  
**Branch:** feature/regenerate-with-instructions

## 1. Objective

The existing Judge AI workflow generated a complete new decision draft when the Generate action was used. The goal of this implementation is to give the judge explicit control over regeneration by allowing:

- additional free-text instructions for the AI;
- selection of the draft version to use as the baseline;
- selection of exactly which decision sections may be rewritten;
- deterministic preservation of all non-selected sections;
- automatic creation of a new numbered draft version instead of overwriting an existing version;
- auditability of the regeneration request;
- temporary file attachments that can guide style, structure, or supplementary context for a single regeneration run.

## 2. User-facing behavior

When a case has no draft, **Generate decision draft** continues to create the initial structured five-section draft.

When a draft already exists, the main generation action routes the judge to the regeneration controls instead of immediately starting an uncontrolled generation.

The Draft tab now contains a **Regenerate with judge instructions** panel with:

1. **Additional AI instructions** — free-text textbox.
2. **Baseline version** — selector containing stored draft versions for the case.
3. **Reference files for this regeneration** — attach temporary PDF/DOCX/TXT/MD/HTML/JSON/image files.
4. **Per-file purpose** — Style, Reference, or Structure.
5. **Optional per-file instruction** — e.g. “Follow the formal tone and sentence rhythm of this judgment.”
6. **Sections the AI may rewrite** — Header, Facts, Issues, Reasoning, Operative Part.
7. **Regenerate as new version** action.
8. **Reset controls** action.

At least one section must remain selected.

The legal-consistency review screen's **New Generation** action no longer immediately generates. It transfers the unresolved review findings into the regeneration instruction textbox, selects the current draft as baseline, and opens the Draft tab so the judge can edit the instructions before running.

## 3. Version preservation

The existing database model already uses `drafts.versionNo` and creates each generated draft as a new row.

No schema migration was required.

A regeneration creates the next numbered draft version. The baseline draft remains stored and available in draft history.

The workspace API now exposes recent draft versions through `draftHistory` so the UI can choose a prior version as the baseline.

## 4. Backend API changes

### tRPC route

`judgeAi.drafts.generate` now accepts:

- `caseId`
- `providerId` (existing)
- `profileId` (existing)
- `reviewContext` (existing)
- `customInstructions?: string | null`
- `rewriteSections?: ("header" | "facts" | "issues" | "reasoning" | "operative_part")[] | null`
- `sourceDraftId?: number | null`
- `referenceAttachments?: Array<{ fileName; mimeType; base64Content; sizeBytes; purpose; note }>`

Validation limits:

- custom instructions: max 12,000 characters;
- review context: max 20,000 characters;
- rewrite section list: 1–5 known section keys;
- reference attachments: maximum 8 files;
- maximum 25 MB per attachment;
- maximum 50 MB total attachments;
- optional per-file note: max 1,000 characters;
- accepted temporary reference purposes: `style`, `reference`, `structure`.

The backend rejects a baseline draft belonging to a different case.

Section-scoped regeneration requires a baseline draft.

## 5. Prompt engineering

`buildCasePrompt()` now supports:

- `customInstructions`
- `rewriteSections`
- `sourceDraft`
- `regenerationReferences`

For regeneration, the prompt explicitly tells the model:

- which draft version is the baseline;
- which sections are intended to be rewritten;
- that other sections are locked;
- the judge's additional instructions;
- the baseline draft text;
- extracted text from temporary reference attachments;
- trusted judge instructions describing how each attached file should be used.

Judge instructions are subordinate to legal accuracy, case facts, source safety, and the required structured output schema.

Temporary attachments are deliberately separated into two layers:

- **trusted judge metadata** (purpose and optional note) is placed in the instruction layer;
- **document contents** are wrapped as untrusted `<regeneration_reference>` source blocks so embedded commands in an uploaded document are never treated as authoritative instructions.

For `purpose=style`, the model may mirror high-level tone, sentence rhythm, terminology preferences, and drafting conventions without copying distinctive passages. `purpose=structure` may guide organization only. `purpose=reference` is supplementary context and must not silently become verified evidence or binding law.

## 6. Hard section locking

Prompt instructions alone are not treated as sufficient enforcement.

After the model returns a full five-section structured draft, `applyRegenerationScope()` replaces every non-selected generated section with the corresponding section from the selected baseline draft before persistence.

This preserves, for locked sections:

- section title;
- section text;
- paragraph text;
- paragraph rationale;
- confidence score;
- annotations and source linkage metadata.

Therefore a request such as **rewrite only Reasoning** cannot modify Facts, Issues, Header, or Operative Part in the stored new version even if the model attempts to change them.

## 7. Audit trail

The draft-generation processing job's `payloadJson` now records:

- provider ID;
- profile ID;
- style profile state;
- source draft ID;
- source version number;
- rewrite section list;
- custom judge instructions;
- review context;
- attachment filename, MIME type, declared size, purpose, and optional note.

The `draft.generated` case activity event also records the regeneration metadata plus a SHA-256 digest for each processed attachment.

Raw attachment bytes/base64 are not written into the case record or processing-job audit payload by this feature.

The complete generation prompt continues to be retained in `generationPromptSnapshot`.

## 8. UI localization

English and Greek strings were added for all regeneration controls.

## 9. Files changed

- `client/src/pages/Home.tsx`
- `client/src/locales/translations.ts`
- `server/db.ts`
- `server/judgeAiRouter.ts`
- `server/judgeAiService.ts`
- `server/judgeAiService.test.ts`

## 10. Tests added

Focused tests cover:

1. inclusion of baseline version, rewrite scope, and judge instructions in the generation prompt;
2. deterministic preservation of locked sections when only a selected section is regenerated;
3. inclusion of temporary style/structure references with explicit purpose and prompt-safety boundaries;
4. placement of judge-provided attachment notes outside the untrusted document source blocks.

## 11. Validation status

A source-level TypeScript review and GitHub diff review were completed.

The local desktop tunnel was unavailable during implementation, so `pnpm check` and the full local Vitest suite could not be executed against the user's Windows checkout from this session.

Recommended final local validation:

```bash
pnpm check
pnpm test
pnpm build
```

## 12. Security and legal-control considerations

- The feature does not weaken the existing source-safety instructions.
- User instructions cannot override the required structured output schema.
- Legal accuracy and case facts remain higher-priority constraints.
- The original draft is never destroyed by regeneration.
- Cross-case baseline selection is rejected server-side.
- Locked sections are enforced in application code, not merely by model compliance.
- Temporary reference files are not silently added to permanent case evidence.
- Attached document content is treated as untrusted source material to reduce prompt-injection risk.
- Style references may influence writing style but cannot override verified facts, legal constraints, or source requirements.
- Extracted attachment text is capped at 20,000 characters per file and 60,000 characters total before entering the model prompt.
