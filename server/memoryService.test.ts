import { describe, expect, it } from "vitest";
import { buildMemoryPrompt, type UserMemoryItem } from "./memoryService";

function memory(overrides: Partial<UserMemoryItem> = {}): UserMemoryItem {
  return {
    id: 1,
    userId: 7,
    scope: "global",
    caseId: null,
    caseType: null,
    category: "preference",
    content: "Prefer concise reasoning paragraphs.",
    confidence: "0.900",
    reinforcementCount: 2,
    usageCount: 0,
    status: "active",
    sourceEventId: 10,
    createdAt: new Date("2026-10-03T00:00:00Z"),
    updatedAt: new Date("2026-10-03T00:00:00Z"),
    lastUsedAt: null,
    ...overrides,
  };
}

describe("buildMemoryPrompt", () => {
  it("returns an empty string when no memories are relevant", () => {
    expect(buildMemoryPrompt([])).toBe("");
  });

  it("keeps memory subordinate to current evidence and instruction", () => {
    const prompt = buildMemoryPrompt([memory()]);
    expect(prompt).toContain("Current explicit instructions override memory");
    expect(prompt).toContain("Case evidence and applicable law override both");
    expect(prompt).toContain("Prefer concise reasoning paragraphs.");
  });

  it("marks edited text as an example rather than reusable case facts", () => {
    const prompt = buildMemoryPrompt([
      memory({
        scope: "case",
        caseId: 42,
        category: "edit_example",
        content: "The claimant inherited the apartment.",
      }),
    ]);
    expect(prompt).toContain("writing/structure example");
    expect(prompt).toContain("never copy its case-specific facts");
  });

  it("labels case-type-scoped preferences", () => {
    const prompt = buildMemoryPrompt([
      memory({
        scope: "case_type",
        caseType: "inheritance",
        category: "instruction",
      }),
    ]);
    expect(prompt).toContain("case type: inheritance");
  });
});
