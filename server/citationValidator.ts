export type UnresolvedCitation = {
  citation: string;
  occurrences: number;
};

// Recognises common Greek legal shorthand (ΑΚ 1710, ΚΠολΔ 924, ΠΚ 299, Ν. 4548/2018,
// άρθρο 57 Σ). Captures the short code + article number; callers validate those
// against the knowledge base by substring-match against the document's
// citation/title field.
const LEGAL_CITATION_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: "ΑΚ",    regex: /\bΑΚ\s*\.?\s*(\d{1,5})\b/gu },
  { label: "ΚΠολΔ", regex: /\bΚΠολΔ\s*\.?\s*(\d{1,5})\b/gu },
  { label: "ΠΚ",    regex: /\bΠΚ\s*\.?\s*(\d{1,5})\b/gu },
  { label: "ΚΠΔ",   regex: /\bΚΠΔ\s*\.?\s*(\d{1,5})\b/gu },
  { label: "Ν.",    regex: /\bΝ\.\s*(\d{1,5}\/\d{2,4})\b/gu },
  { label: "ΠΔ",    regex: /\bΠ\.?Δ\.?\s*(\d{1,5}\/\d{2,4})\b/gu },
  { label: "άρθρο Σ", regex: /\bάρθρο\s+(\d{1,3})\s+Σ(?:υντάγματος)?\b/gu },
];

export function extractLegalCitations(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { label, regex } of LEGAL_CITATION_PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const canonical = `${label} ${match[1]}`;
      counts.set(canonical, (counts.get(canonical) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Given the full text of a draft and the list of knowledge documents available
 * to the user, return the set of citations that don't resolve to a knowledge-
 * base entry. Non-blocking by design — callers use this to warn the judge.
 */
export function findUnresolvedCitations(
  draftText: string,
  knowledgeEntries: Array<{ title?: string | null; citation?: string | null }>,
): UnresolvedCitation[] {
  const citations = extractLegalCitations(draftText);
  if (citations.size === 0) return [];

  const haystack = knowledgeEntries
    .map(doc => `${doc.citation ?? ""} ${doc.title ?? ""}`)
    .join("\n")
    .toLowerCase();

  const unresolved: UnresolvedCitation[] = [];
  for (const [citation, occurrences] of citations) {
    if (!haystack.includes(citation.toLowerCase())) {
      unresolved.push({ citation, occurrences });
    }
  }
  return unresolved;
}
