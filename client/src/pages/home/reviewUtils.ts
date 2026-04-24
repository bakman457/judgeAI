export type ReviewSeverity = "high" | "medium" | "low" | string;

export type ReviewFinding = {
  category?: string;
  severity?: ReviewSeverity;
  issue?: string;
  explanation?: string;
  recommendedAction?: string;
  supportingSources?: string[];
};

export type ReviewIssue = {
  question?: string;
  significance?: string;
  supportingSources?: string[];
};

export type CaseReviewResult = {
  reviewSnapshotId?: number;
  reviewedDraftVersionNo?: number | null;
  reviewTemplateKey?: string | null;
  createdAt?: string | number | Date | null;
  summary?: string;
  outcomeAssessment?: string;
  confidenceScore?: string;
  extractedIssues?: ReviewIssue[];
  findings?: ReviewFinding[];
  citationChecks?: Array<Record<string, unknown>>;
  missingEvidence?: string[];
  missingLaw?: string[];
  credibilitySignals?: Array<Record<string, unknown>>;
  contradictions?: Array<Record<string, unknown>>;
  precedentAnalysis?: Array<Record<string, unknown>>;
  reasoningStructure?: {
    ratioDecidendi?: string[];
    obiterDicta?: string[];
  };
  decisionQuality?: {
    score?: number;
    band?: string;
    rationale?: string;
  };
  jurisdictionAndAdmissibility?: {
    status?: string;
    note?: string;
  };
  proportionalityReview?: {
    status?: string;
    note?: string;
  };
  judgeFeedback?: string[];
  preSignatureReview?: {
    readyForSignature?: boolean;
    blockers?: string[];
    recommendedActions?: string[];
  };
  thresholdEvaluation?: {
    blockers?: string[];
  };
  appellateStressTest?: {
    strongestOpposingArgument?: string;
    rebuttalSuggestion?: string;
  };
  chronologicalEvents?: {
    date: string;
    event: string;
    significance: "high" | "medium" | "low";
  }[];
};

export type ReviewSnapshot = {
  id: number;
  resultJson?: CaseReviewResult | null;
  draftVersionNo?: number | null;
  reviewTemplateKey?: string | null;
  createdAt?: string | number | Date | null;
  qualityScore?: number;
  readyForSignature?: boolean;
};

type ReviewDiffStatus = "added" | "removed" | "changed" | "unchanged";

export function toSavedReviewResult(snapshot: ReviewSnapshot | null | undefined): CaseReviewResult | null {
  if (!snapshot) return null;
  return {
    ...(snapshot.resultJson ?? {}),
    reviewSnapshotId: snapshot.id,
    reviewedDraftVersionNo: snapshot.draftVersionNo,
    reviewTemplateKey: snapshot.reviewTemplateKey,
    createdAt: snapshot.createdAt,
  };
}

function uniqueReviewItems(values: unknown[] = []) {
  return Array.from(
    new Set(
      (values ?? [])
        .map(item => String(item ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function diffReviewTextLists(currentValues: unknown[] = [], previousValues: unknown[] = []) {
  const current = uniqueReviewItems(currentValues);
  const previous = uniqueReviewItems(previousValues);
  return {
    added: current.filter(item => !previous.includes(item)),
    removed: previous.filter(item => !current.includes(item)),
  };
}

function diffReviewObjects<T>(currentItems: T[] = [], previousItems: T[] = [], keyBuilder: (item: T) => string) {
  const currentMap = new Map((currentItems ?? []).map(item => [keyBuilder(item), item]));
  const previousMap = new Map((previousItems ?? []).map(item => [keyBuilder(item), item]));

  return {
    added: Array.from(currentMap.entries())
      .filter(([key]) => !previousMap.has(key))
      .map(([, item]) => item),
    removed: Array.from(previousMap.entries())
      .filter(([key]) => !currentMap.has(key))
      .map(([, item]) => item),
  };
}

function normalizeFindingKey(item: ReviewFinding) {
  return String(item?.issue ?? "").trim().toLowerCase();
}

function buildFindingComparison(currentItems: ReviewFinding[] = [], previousItems: ReviewFinding[] = []) {
  const current = currentItems ?? [];
  const previous = previousItems ?? [];
  const previousByIssue = new Map(previous.map(item => [normalizeFindingKey(item), item]));
  const currentByIssue = new Map(current.map(item => [normalizeFindingKey(item), item]));

  const buildChangeSummary = (currentItem: ReviewFinding, previousItem: ReviewFinding) => {
    const summary: string[] = [];
    const currentSeverity = String(currentItem?.severity ?? "medium").toUpperCase();
    const previousSeverity = String(previousItem?.severity ?? "medium").toUpperCase();

    if (currentSeverity !== previousSeverity) {
      summary.push(`Severity ${previousSeverity} -> ${currentSeverity}`);
    }

    const currentRecommendation = String(currentItem?.recommendedAction ?? "").trim();
    const previousRecommendation = String(previousItem?.recommendedAction ?? "").trim();
    if (currentRecommendation !== previousRecommendation && (currentRecommendation || previousRecommendation)) {
      summary.push("Recommended action updated");
    }

    return summary;
  };

  const currentRows = current.map(item => {
    const previousItem = previousByIssue.get(normalizeFindingKey(item));
    if (!previousItem) {
      return { item, previousItem: null, status: "added" as const, changeSummary: ["New finding"] };
    }

    const changeSummary = buildChangeSummary(item, previousItem);
    return {
      item,
      previousItem,
      status: (changeSummary.length ? "changed" : "unchanged") as Extract<ReviewDiffStatus, "changed" | "unchanged">,
      changeSummary,
    };
  });

  const previousRows = previous.map(item => {
    const currentItem = currentByIssue.get(normalizeFindingKey(item));
    if (!currentItem) {
      return { item, currentItem: null, status: "removed" as const, changeSummary: ["Resolved or removed"] };
    }

    const changeSummary = buildChangeSummary(currentItem, item);
    return {
      item,
      currentItem,
      status: (changeSummary.length ? "changed" : "unchanged") as Extract<ReviewDiffStatus, "changed" | "unchanged">,
      changeSummary,
    };
  });

  return {
    currentRows,
    previousRows,
    changedCount:
      currentRows.filter(row => row.status === "added" || row.status === "changed").length
      + previousRows.filter(row => row.status === "removed").length,
  };
}

export function getFindingHighlightMeta(status: ReviewDiffStatus) {
  if (status === "added") {
    return {
      label: "New",
      containerClass: "border-emerald-300/80 bg-emerald-50/90 dark:border-emerald-500/40 dark:bg-emerald-500/10",
      badgeClass: "bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950",
    };
  }
  if (status === "removed") {
    return {
      label: "Resolved",
      containerClass: "border-rose-300/80 bg-rose-50/90 dark:border-rose-500/40 dark:bg-rose-500/10",
      badgeClass: "bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950",
    };
  }
  if (status === "changed") {
    return {
      label: "Changed",
      containerClass: "border-amber-300/80 bg-amber-50/90 dark:border-amber-500/40 dark:bg-amber-500/10",
      badgeClass: "bg-amber-500 text-amber-950 dark:bg-amber-300 dark:text-amber-950",
    };
  }
  return {
    label: "Stable",
    containerClass: "border-stone-200/80 bg-white/95 dark:border-stone-700/80 dark:bg-white/[0.05]",
    badgeClass: "bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-100",
  };
}

export function buildReviewComparison(currentSnapshot: ReviewSnapshot | null | undefined, previousSnapshot: ReviewSnapshot | null | undefined) {
  if (!currentSnapshot || !previousSnapshot) return null;

  const currentReview = currentSnapshot.resultJson ?? {};
  const previousReview = previousSnapshot.resultJson ?? {};
  const blockerDiff = diffReviewTextLists(currentReview.preSignatureReview?.blockers ?? [], previousReview.preSignatureReview?.blockers ?? []);
  const missingEvidenceDiff = diffReviewTextLists(currentReview.missingEvidence ?? [], previousReview.missingEvidence ?? []);
  const missingLawDiff = diffReviewTextLists(currentReview.missingLaw ?? [], previousReview.missingLaw ?? []);
  const issueDiff = diffReviewObjects(
    currentReview.extractedIssues ?? [],
    previousReview.extractedIssues ?? [],
    item => `${item?.question ?? ""}::${item?.significance ?? ""}`,
  );
  const findingDiff = diffReviewObjects(
    currentReview.findings ?? [],
    previousReview.findings ?? [],
    item => `${item?.severity ?? ""}::${item?.issue ?? ""}`,
  );
  const findingComparison = buildFindingComparison(currentReview.findings ?? [], previousReview.findings ?? []);

  return {
    currentReview,
    previousReview,
    currentSnapshot,
    previousSnapshot,
    qualityScoreDelta: (Number(currentReview.decisionQuality?.score) || 0) - (Number(previousReview.decisionQuality?.score) || 0),
    blockerDiff,
    missingEvidenceDiff,
    missingLawDiff,
    issueDiff,
    findingDiff,
    findingComparison,
    findingChangeCount: findingComparison.changedCount,
  };
}
