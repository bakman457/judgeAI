export type IntakeCaseStatus = "created" | "document_review" | "drafting" | "under_review" | "approved" | "archived" | string;

export type IntakeCaseItem = {
  id: number;
  title: string;
  caseNumber: string;
  caseType: string;
  courtLevel: string;
  status: IntakeCaseStatus;
  updatedAt: string | Date;
};

export type IntakeDeadlineState = "overdue" | "dueSoon" | "onTrack";
export type IntakePriorityLevel = "critical" | "high" | "normal";

export type IntakeQueueItem = IntakeCaseItem & {
  ageHours: number;
  deadlineState: IntakeDeadlineState;
  priorityLevel: IntakePriorityLevel;
  priorityScore: number;
};

const DEADLINE_WINDOWS: Record<string, number> = {
  created: 24,
  document_review: 48,
  drafting: 72,
  under_review: 48,
  approved: 120,
  archived: 9_999,
};

const BASE_SCORES: Record<string, number> = {
  created: 100,
  document_review: 88,
  drafting: 72,
  under_review: 64,
  approved: 20,
  archived: 0,
};

export function buildIntakeQueue(items: IntakeCaseItem[], now = Date.now()): IntakeQueueItem[] {
  return items
    .filter(item => item.status !== "archived")
    .map(item => {
      const updatedAtMs = new Date(item.updatedAt).getTime();
      const ageHours = Math.max(0, (now - updatedAtMs) / 3_600_000);
      const windowHours = DEADLINE_WINDOWS[item.status] ?? 72;
      const remainingHours = windowHours - ageHours;
      const deadlineState: IntakeDeadlineState =
        remainingHours <= 0 ? "overdue" : remainingHours <= Math.min(24, windowHours / 2) ? "dueSoon" : "onTrack";
      const priorityLevel: IntakePriorityLevel =
        deadlineState === "overdue"
          ? "critical"
          : deadlineState === "dueSoon" || item.status === "created" || item.status === "document_review"
            ? "high"
            : "normal";
      const priorityScore =
        (BASE_SCORES[item.status] ?? 0) + Math.round(ageHours) + (deadlineState === "overdue" ? 40 : deadlineState === "dueSoon" ? 18 : 0);

      return {
        ...item,
        ageHours,
        deadlineState,
        priorityLevel,
        priorityScore,
      } satisfies IntakeQueueItem;
    })
    .sort((left, right) => right.priorityScore - left.priorityScore || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

export function buildIntakeMetrics(queue: IntakeQueueItem[]) {
  return {
    priorityNow: queue.filter(item => item.priorityLevel !== "normal").length,
    dueSoon: queue.filter(item => item.deadlineState === "dueSoon").length,
    overdue: queue.filter(item => item.deadlineState === "overdue").length,
  };
}
