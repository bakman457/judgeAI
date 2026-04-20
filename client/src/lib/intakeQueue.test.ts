import { describe, it, expect } from "vitest";
import { buildIntakeMetrics, buildIntakeQueue } from "./intakeQueue";

describe("buildIntakeQueue", () => {
  const now = new Date("2026-04-15T12:00:00.000Z").getTime();

  it("prioritizes overdue and due-soon matters ahead of lower-risk items", () => {
    const queue = buildIntakeQueue(
      [
        {
          id: 1,
          title: "Fresh intake",
          caseNumber: "A-1",
          caseType: "Civil",
          courtLevel: "First Instance",
          status: "created",
          updatedAt: "2026-04-15T06:00:00.000Z",
        },
        {
          id: 2,
          title: "Stalled review",
          caseNumber: "A-2",
          caseType: "Administrative",
          courtLevel: "Appeal",
          status: "under_review",
          updatedAt: "2026-04-12T08:00:00.000Z",
        },
        {
          id: 3,
          title: "Draft in progress",
          caseNumber: "A-3",
          caseType: "Criminal",
          courtLevel: "First Instance",
          status: "drafting",
          updatedAt: "2026-04-15T09:00:00.000Z",
        },
      ],
      now,
    );

    expect(queue[0].id).toBe(2);
    expect(queue[0].deadlineState).toBe("overdue");
    expect(queue[0].priorityLevel).toBe("critical");
    expect(queue[1].id).toBe(1);
    expect(queue[1].priorityLevel).toBe("high");
    expect(queue[2].id).toBe(3);
    expect(queue[2].priorityLevel).toBe("normal");
  });

  it("omits archived matters from the active intake queue", () => {
    const queue = buildIntakeQueue(
      [
        {
          id: 9,
          title: "Archived file",
          caseNumber: "ARCH-1",
          caseType: "Civil",
          courtLevel: "First Instance",
          status: "archived",
          updatedAt: "2026-04-10T12:00:00.000Z",
        },
      ],
      now,
    );

    expect(queue).toHaveLength(0);
  });
});

describe("buildIntakeMetrics", () => {
  it("summarizes priority, due-soon, and overdue counts from the queue", () => {
    const metrics = buildIntakeMetrics([
      {
        id: 1,
        title: "Critical",
        caseNumber: "1",
        caseType: "Civil",
        courtLevel: "First Instance",
        status: "under_review",
        updatedAt: "2026-04-10T12:00:00.000Z",
        ageHours: 96,
        deadlineState: "overdue",
        priorityLevel: "critical",
        priorityScore: 150,
      },
      {
        id: 2,
        title: "Soon",
        caseNumber: "2",
        caseType: "Criminal",
        courtLevel: "Appeal",
        status: "document_review",
        updatedAt: "2026-04-14T20:00:00.000Z",
        ageHours: 16,
        deadlineState: "dueSoon",
        priorityLevel: "high",
        priorityScore: 110,
      },
      {
        id: 3,
        title: "Stable",
        caseNumber: "3",
        caseType: "Administrative",
        courtLevel: "First Instance",
        status: "approved",
        updatedAt: "2026-04-15T10:00:00.000Z",
        ageHours: 2,
        deadlineState: "onTrack",
        priorityLevel: "normal",
        priorityScore: 22,
      },
    ]);

    expect(metrics).toEqual({
      priorityNow: 2,
      dueSoon: 1,
      overdue: 1,
    });
  });
});
