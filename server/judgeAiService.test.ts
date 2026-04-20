import { describe, expect, it } from "vitest";
import {
  buildCaseReviewPrompt,
  countReviewFindingsBySeverity,
  evaluateReviewAgainstThreshold,
  inferCaseDocumentType,
  inferKnowledgeDocumentType,
  normalizeUploadMimeType,
  renderCaseReviewReportToPdf,
} from "./judgeAiService";

describe("judgeAiService classifiers", () => {
  it("normalizes generic octet-stream uploads based on file extension", () => {
    expect(normalizeUploadMimeType("judgment.pdf", "application/octet-stream")).toBe("application/pdf");
    expect(normalizeUploadMimeType("pleading.docx", "application/octet-stream")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(normalizeUploadMimeType("notes.txt", "application/octet-stream")).toBe("text/plain");
  });

  it("preserves explicit non-generic mime types", () => {
    expect(normalizeUploadMimeType("archive.pdf", "application/pdf")).toBe("application/pdf");
  });

  it("infers case document categories from filenames and extracted text", () => {
    expect(inferCaseDocumentType("final-judgment.pdf")).toBe("decision");
    expect(inferCaseDocumentType("medical-report.pdf", "Forensic report and attached invoice")).toBe("evidence");
    expect(inferCaseDocumentType("statement-of-claim.docx")).toBe("pleading");
  });

  it("infers knowledge document categories from filenames and extracted text", () => {
    expect(inferKnowledgeDocumentType("civil-code.pdf", "Code of Civil Procedure article 12")).toBe("statute");
    expect(inferKnowledgeDocumentType("ministerial-decree.docx", "Ministerial decree regulating submissions")).toBe("regulation");
    expect(inferKnowledgeDocumentType("leading-precedent.pdf", "Supreme Court precedent on admissibility")).toBe("precedent");
  });
});

describe("approval threshold helpers", () => {
  it("counts medium and high severity review findings for saved review snapshots", () => {
    const counts = countReviewFindingsBySeverity({
      findings: [
        { severity: "high" },
        { severity: "medium" },
        { severity: "medium" },
        { severity: "low" },
      ],
    } as any);

    expect(counts).toEqual({ highSeverityCount: 1, mediumSeverityCount: 2 });
  });

  it("blocks approval when the review falls below the configured case-type threshold", () => {
    const evaluation = evaluateReviewAgainstThreshold(
      {
        qualityScore: 78,
        readyForSignature: false,
        highSeverityCount: 1,
        mediumSeverityCount: 3,
      },
      {
        caseTypeKey: "criminal",
        minimumQualityScore: 85,
        requireReadyForSignature: true,
        maxHighSeverityFindings: 0,
        maxMediumSeverityFindings: 1,
      } as any,
    );

    expect(evaluation.passed).toBe(false);
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Quality score 78 is below the criminal threshold of 85."),
        expect.stringContaining("not marked this draft ready for signature"),
        expect.stringContaining("High-severity findings (1) exceed the allowed limit of 0."),
        expect.stringContaining("Medium-severity findings (3) exceed the allowed limit of 1."),
      ]),
    );
  });

  it("allows approval when the saved review satisfies the configured threshold", () => {
    const evaluation = evaluateReviewAgainstThreshold(
      {
        qualityScore: 92,
        readyForSignature: true,
        highSeverityCount: 0,
        mediumSeverityCount: 1,
      },
      {
        caseTypeKey: "civil",
        minimumQualityScore: 85,
        requireReadyForSignature: true,
        maxHighSeverityFindings: 0,
        maxMediumSeverityFindings: 2,
      } as any,
    );

    expect(evaluation).toEqual({ passed: true, blockers: [] });
  });
});

describe("review report rendering", () => {
  it("renders a signed PDF review report for saved review snapshots", async () => {
    const buffer = await renderCaseReviewReportToPdf({
      caseNumber: "2026/21",
      caseTitle: "Signed PDF export review",
      caseType: "Civil",
      courtLevel: "Appeal",
      snapshotId: 14,
      draftVersionNo: 3,
      reviewTemplateKey: "civil",
      createdAt: "2026-04-14T20:00:00.000Z",
      signerName: "Judge Example",
      signerRoleLabel: "judge",
      exportedAt: "2026-04-14T20:05:00.000Z",
      review: {
        summary: "The saved review confirms that citation support improved, but one evidentiary gap remains.",
        outcomeAssessment: "Conditionally suitable for signature once the last evidentiary issue is addressed.",
        confidenceScore: 0.86,
        extractedIssues: [{ question: "Was contractual notice adequately proved?", significance: "The finding of breach depends on timely notice." }],
        findings: [{ severity: "medium", issue: "Notice chronology still needs a clearer explanation.", explanation: "The draft should connect the email timeline to the contractual deadline." }],
        missingEvidence: ["Clarify whether the delivery receipt confirms the exact date of notice."],
        missingLaw: ["Address the appellate standard for harmless notice defects."],
        citationChecks: [{ citation: "Civil Code art. 112", status: "supported", note: "The cited article aligns with the contractual notice rule." }],
        contradictionMap: [],
        credibilitySignals: [],
        precedentAnalysis: [],
        reasoningStructure: {
          ratioDecidendi: ["Notice was timely because the authenticated receipt falls within the contractual period."],
          obiterDicta: ["The dispute also reflects broader recordkeeping weaknesses."],
        },
        jurisdictionAndAdmissibility: {
          jurisdictionStatus: "satisfied",
          admissibilityStatus: "satisfied",
          notes: ["The appellate court has jurisdiction and the appeal is admissible."],
        },
        remedyAndSanctionAnalysis: {
          proportionalityStatus: "proportionate",
          notes: ["The proposed remedy is limited to contractual damages and remains proportionate."],
        },
        decisionQuality: {
          score: 91,
          band: "strong",
          rationale: "The review is coherent and well-supported aside from one remaining evidentiary clarification.",
        },
        preSignatureReview: {
          readyForSignature: false,
          blockers: ["Explain the notice timeline with one additional sentence in the reasoning section."],
          recommendedActions: ["Add the delivery-receipt explanation before final approval."],
        },
      },
    } as any);

    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.length).toBeGreaterThan(1500);
  });
});

describe("buildCaseReviewPrompt", () => {
  it("uses the latest draft when no explicit judgment text is provided", () => {
    const prompt = buildCaseReviewPrompt({
      workspace: {
        case: {
          caseNumber: "2026/15",
          title: "Sample administrative dispute",
          jurisdictionCode: "GR",
          courtLevel: "Appeal",
          caseType: "Administrative",
          summary: "Challenge against a permit refusal.",
        },
        documents: [
          {
            id: 7,
            title: "Expert report",
            documentType: "evidence",
            uploadStatus: "completed",
            extractedText: "The expert confirms the measurements and the timeline.",
          },
        ],
        latestDraft: {
          sections: [
            { sectionTitle: "Reasoning", sectionText: "The current draft concludes that the refusal lacked sufficient basis." },
          ],
        },
      } as any,
      knowledge: [
        {
          id: 3,
          title: "Permit Code",
          documentType: "statute",
          citation: "Law 123/2020",
          extractedText: "Article 10 requires a proportionate assessment and clear evidence.",
        },
      ] as any,
    });

    expect(prompt.systemPrompt).toContain("expert reviewer of Greek inheritance-law decisions");
    expect(prompt.userPrompt).toContain("Sample administrative dispute");
    expect(prompt.userPrompt).toContain("The current draft concludes that the refusal lacked sufficient basis.");
    expect(prompt.userPrompt).toContain("Permit Code");
  });

  it("prefers the provided judgment text over the stored draft", () => {
    const prompt = buildCaseReviewPrompt({
      workspace: {
        case: {
          caseNumber: "2026/16",
          title: "Evidence sufficiency test",
          jurisdictionCode: "GR",
          courtLevel: "First Instance",
          caseType: "Civil",
          summary: null,
        },
        documents: [],
        latestDraft: {
          sections: [
            { sectionTitle: "Reasoning", sectionText: "Stored draft text that should not be used when explicit text exists." },
          ],
        },
      } as any,
      knowledge: [] as any,
      judgmentText: "Explicit judgment text supplied by the user for targeted review.",
    });

    expect(prompt.userPrompt).toContain("Explicit judgment text supplied by the user for targeted review.");
    expect(prompt.userPrompt).not.toContain("Stored draft text that should not be used when explicit text exists.");
  });

  it("locks the full judicial-quality review package into the prompt instructions", () => {
    const prompt = buildCaseReviewPrompt({
      workspace: {
        case: {
          caseNumber: "2026/17",
          title: "Comprehensive quality review",
          jurisdictionCode: "GR",
          courtLevel: "Supreme",
          caseType: "Criminal",
          summary: "A draft judgment must be checked for legal issues, precedent use, and sanction proportionality.",
        },
        documents: [
          {
            id: 11,
            title: "Witness statement",
            documentType: "evidence",
            uploadStatus: "completed",
            extractedText: "The witness places the accused at the scene but the timeline remains contested.",
          },
        ],
        latestDraft: null,
      } as any,
      knowledge: [
        {
          id: 8,
          title: "Leading criminal precedent",
          documentType: "precedent",
          citation: "Supreme Court 145/2021",
          extractedText: "The ratio requires corroboration before imposing a severe custodial sanction.",
        },
      ] as any,
      reviewTemplateKey: "inheritance",
      reviewTemplateFocus: "Test corroboration gaps, citation support, admissibility, and sentencing proportionality.",
      judgmentText: "The draft cites Supreme Court 145/2021 and proposes an immediate custodial sanction.",
    });

    expect(prompt.userPrompt).toContain("Greek inheritance-law review template");
    expect(prompt.userPrompt).toContain("Additional review focus: Test corroboration gaps, citation support, admissibility, and sentencing proportionality.");
    expect(prompt.userPrompt).toContain("Populate every section of the schema, including extracted legal issues, citation verification, contradiction mapping, credibility signals, precedent analysis, ratio decidendi versus obiter dicta, jurisdiction and admissibility, proportionality, decision quality score, and pre-signature blockers.");
    expect(prompt.userPrompt).toContain("If the record does not contain enough support, say so explicitly in missing-law, missing-evidence, findings, and pre-signature blockers.");
    expect(prompt.systemPrompt).toContain("separate ratio decidendi from obiter dicta");
    expect(prompt.systemPrompt).toContain("identify contradictions, credibility concerns, and reasoning weaknesses");
  });
});
