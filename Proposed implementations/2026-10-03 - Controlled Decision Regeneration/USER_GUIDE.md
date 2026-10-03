# User Guide — Controlled Decision Regeneration

**Date:** 2026-10-03  
**Feature:** Controlled Decision Regeneration

## What this feature does

After Judge AI has generated a decision draft, you can now ask it to produce a revised version while telling it exactly what to change.

You can also decide which sections are allowed to change and which must remain exactly as they were in the selected baseline version.

Every regeneration creates a new numbered version. It does not overwrite the previous draft.

## Initial generation

For a case with no existing draft:

1. Open the case.
2. Upload/review the relevant case material.
3. Click **Generate decision draft**.
4. Wait for the generation job to complete.
5. Open the **Draft** tab to review the structured decision.

## Regenerating an existing decision

If a draft already exists:

1. Click the generation/regeneration action.
2. Judge AI opens the **Draft** tab.
3. Find **Regenerate with judge instructions**.

### Step 1 — Choose the baseline

Use **Baseline version** to select the version you want the AI to work from.

Normally this should be the latest version, but you can choose an earlier version if a later draft moved in the wrong direction.

### Step 2 — Write your instructions

In **Additional AI instructions**, describe what you want changed.

Examples:

- Strengthen the reasoning on the validity of the handwritten will.
- Address the respondent's argument concerning the legitimate share.
- Explain why Article 1847 applies to the renunciation deadline.
- Make the operative part more concise.
- Expand the analysis of the evidentiary contradiction between Exhibit 4 and the witness statement.
- Preserve the existing factual findings but rewrite the reasoning more clearly.

Be concrete. State both the legal issue and the desired drafting change.

### Step 3 — Attach reference files (optional)

You may attach files that Judge AI should consider during this regeneration.

Supported examples include PDF, DOCX, TXT, Markdown, HTML, JSON, and common image formats.

Limits:

- up to 8 files;
- maximum 25 MB per file;
- maximum 50 MB total.

Each file has a **How the AI should use this file** setting:

- **Style** — use the document as a writing-style reference. Judge AI may mirror high-level tone, sentence rhythm, terminology preferences, and drafting conventions.
- **Structure** — use the document as an organizational/layout reference without importing its facts.
- **Reference** — consider the content as supplementary context, but factual or legal propositions still need support from the permanent case record or legal knowledge base.

You can also add an optional instruction for each file.

Example:

> Follow the formal tone and sentence structure of this judgment, but do not copy its factual content.

These files are temporary. They are used for the current regeneration request and are not automatically added as permanent case evidence.

### Step 4 — Select sections the AI may rewrite

Available sections:

- Header
- Facts
- Issues
- Reasoning
- Operative Part

Selected sections may be regenerated.

Unselected sections are locked and copied unchanged from the selected baseline version.

Example:

If you select only **Reasoning**, Judge AI may create a new Reasoning section, but the stored Header, Facts, Issues, and Operative Part will be preserved from the baseline version.

At least one section must remain selected.

### Step 5 — Regenerate

Click **Regenerate as new version**.

The progress indicator works the same way as normal generation.

After completion:

- the new draft becomes the latest version;
- the previous draft remains saved;
- the baseline selector advances to the new latest version.

## Using legal-consistency review feedback

After running the legal consistency review:

1. Review the findings.
2. Click **New Generation**.
3. Judge AI opens the Draft tab.
4. Unresolved findings are copied into the regeneration instruction textbox.
5. Edit or expand the instructions.
6. Choose which sections may change.
7. Click **Regenerate as new version**.

This allows review feedback to guide the next version without forcing an automatic rewrite.

## Returning to an earlier version

Use the **Baseline version** selector in the regeneration panel.

Selecting an earlier draft does not make it the active draft immediately. It simply tells the next regeneration which version should serve as the source.

## Resetting the controls

Click **Reset controls** to:

- clear the additional instructions;
- restore the latest draft as the baseline;
- allow all five sections to be rewritten;
- remove the temporary regeneration attachments.

## Important behavior

- Regeneration always creates a new version.
- Previous versions are not overwritten.
- Locked sections are enforced by Judge AI's application logic.
- The AI is still required to respect the case evidence, applicable law, and source-safety rules.
- A Style attachment guides writing style only; it does not become evidence.
- Uploaded document contents cannot override Judge AI's system or judge instructions simply by containing commands inside the file.
- Final judicial review and approval remain the responsibility of the judge.
