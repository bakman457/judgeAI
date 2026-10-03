# Judge AI — Enhanced Permanent Memory
## User Guide
**Implementation date:** 2026-10-03

## What Permanent Memory does

Permanent Memory lets Judge AI carry useful preferences and corrections from your work into future AI drafting.

It is different from Judge Style:

- **Judge Style** learns how you normally write.
- **Permanent Memory** remembers what you tell, correct, edit, and reinforce while using the program.

The memory remains stored across application restarts and normal system resets.

## What Judge AI learns automatically

### Paragraph edits

When you edit an AI-generated paragraph, Judge AI records the edited version for that case.

This helps later generations in the same case better follow the way you corrected the draft.

### Section notes

When you save an author note in a draft section, the note becomes part of memory for that case.

### Review feedback

When you accept, address, or defer a review finding, the system records the resolution and any note you entered.

### New generations based on review findings

When a new generation is created from legal-review feedback, that feedback is retained as case memory.

## Permanent Memory screen

Open **Permanent Memory** from the main navigation.

The page shows:

- **Active** — memory items currently eligible for use;
- **Total memories** — active and inactive distilled memory items;
- **Raw learning events** — historical feedback/edit events recorded by Judge AI;
- **Times applied** — how often retrieved memory has been used during successful generations.

## Adding an explicit permanent instruction

Use **Add permanent instruction** when you want Judge AI to remember something intentionally.

Example:

> Prefer concise reasoning paragraphs and explicitly state when evidence is insufficient.

Choose a scope:

### All my cases

The instruction can be used in any future case where it is relevant.

Good examples:

- preferred reasoning length;
- preferred terminology;
- presentation preferences;
- general drafting conventions.

Do not use global memory to store facts about an individual case.

### Case type

The instruction is used only for cases whose `caseType` matches the value you enter.

Example:

- scope: Case type
- case type: `inheritance`
- instruction: “Always distinguish testamentary succession from intestate succession explicitly.”

## Disabling a memory

In the Learned Memories list:

1. find the memory;
2. press **Disable**.

The item becomes inactive and will no longer be injected into future draft prompts.

The underlying historical event is retained.

Press **Activate** to use it again.

## Understanding reinforcement

If Judge AI receives the same memory signal again, it does not create endless duplicate active entries.

Instead, the existing memory's **reinforcement count** increases.

This lets repeated feedback become more prominent during retrieval.

## How memory is applied during generation

When a draft is generated, Judge AI selects relevant active memories in this order:

1. memories specific to the current case;
2. memories for the current case type;
3. global memories.

It then adds the relevant memory to the AI system context.

## Important priority rules

Permanent Memory never overrides:

- evidence in the current case;
- applicable law;
- explicit instructions you give for the current operation.

Case-specific facts remembered from another matter are not valid evidence.

## Best practices

Use global memory for stable personal drafting preferences.

Use case-type memory for recurring conventions that genuinely apply to that class of case.

Keep factual corrections tied to the current case.

Disable obsolete or conflicting memories instead of attempting to overwrite their historical record.

Use Judge Style for stylistic imitation from past judgments rather than trying to duplicate those instructions manually in Permanent Memory.

## What “permanent” means

For this implementation, permanent means the memory is stored in the Judge AI database and survives:

- browser refresh;
- application restart;
- program-data reset;
- settings reset;
- factory reset.

Memory is tied to the user account.

## What it does not mean

Judge AI does not modify the underlying AI model's neural-network weights.

The improvement comes from durable memory retrieval and reinforcement before generation. This makes the behavior auditable and reversible.
