import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  buildProviderEndpoint,
  computeHash,
  decryptSecret,
  encryptSecret,
  renderDraftToDocx,
  validateAndNormalizeDraftOutput,
} from "./judgeAiService";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: "judge" | "admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: role === "admin" ? 99 : 11,
    openId: `${role}-openid`,
    email: `${role}@example.com`,
    name: `${role} user`,
    loginMethod: "manus",
    role,
    status: "active",
    title: role === "admin" ? "Platform Administrator" : "Judge",
    autoApprove: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
    } as unknown as TrpcContext["res"],
  };
}

describe("judgeAi admin authorization", () => {
  it("rejects judge users from admin-only procedures", async () => {
    const caller = appRouter.createCaller(createContext("judge"));

    await expect(caller.judgeAi.admin.listUsers()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("judgeAi service helper functions", () => {
  it("encrypts and decrypts provider secrets symmetrically", () => {
    const raw = "test-secret-value";
    const encrypted = encryptSecret(raw);

    expect(encrypted).not.toBe(raw);
    expect(decryptSecret(encrypted)).toBe(raw);
  });

  it("builds Azure OpenAI endpoints using deployment names", () => {
    const endpoint = buildProviderEndpoint({
      providerType: "azure_openai",
      endpoint: "https://example-resource.openai.azure.com/",
      model: "gpt-4o-deployment",
      azureApiVersion: "2024-10-21",
    });

    expect(endpoint).toBe(
      "https://example-resource.openai.azure.com/openai/deployments/gpt-4o-deployment/chat/completions?api-version=2024-10-21",
    );
  });

  it("produces stable hashes for duplicate-detection comparisons", () => {
    const first = computeHash(Buffer.from("same-content"));
    const second = computeHash(Buffer.from("same-content"));
    const different = computeHash(Buffer.from("different-content"));

    expect(first).toBe(second);
    expect(first).not.toBe(different);
  });

  it("renders a DOCX document structure for approved judicial drafts", () => {
    const document = renderDraftToDocx({
      draft: {
        id: 1,
        caseId: 5,
        versionNo: 3,
        status: "approved",
        generatedByProviderId: 2,
        generationModel: "gpt-4o",
        generationPrompt: "prompt",
        summary: "Summary",
        overallConfidenceScore: "0.88",
        approvedBy: 11,
        approvedAt: new Date(),
        createdBy: 11,
        createdAt: new Date(),
        updatedAt: new Date(),
        sections: [
          {
            id: 101,
            draftId: 1,
            sectionKey: "header",
            sectionTitle: "Header",
            sectionText: "Header text",
            reviewStatus: "approved",
            reviewedBy: 11,
            reviewedAt: new Date(),
            sectionOrder: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            paragraphs: [
              {
                id: 1001,
                sectionId: 101,
                paragraphText: "Decision rendered in the name of the law.",
                rationale: "Opening formula.",
                confidenceScore: "0.99",
                reviewStatus: "approved",
                paragraphOrder: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
                annotations: [],
              },
            ],
          },
        ],
      } as never,
      caseNumber: "2026/05",
    });

    expect(document).toBeDefined();
    expect(document).toHaveProperty("documentWrapper");
  });

  it("normalizes valid AI draft output into the required five judicial sections", () => {
    const normalizedSections = validateAndNormalizeDraftOutput({
      // caseSummary removed — not part of DraftModelOutput
      sections: [
        {
          sectionKey: "reasoning",
          sectionTitle: "Reasoning",
          sectionText: "The court evaluates liability and damages.",
          paragraphs: [
            {
              paragraphText: "The contractual breach is established on the record.",
              rationale: "Relies on the delivery documents and the correspondence between the parties.",
              confidenceScore: "0.87",
              annotations: [],
            },
          ],
        },
        {
          sectionKey: "facts",
          sectionTitle: "Facts",
          sectionText: "The parties entered a supply agreement in 2023.",
          paragraphs: [
            {
              paragraphText: "The claimant delivered partial goods on 11 March 2023.",
              rationale: "Based on the signed transport note.",
              confidenceScore: "0.82",
              annotations: [],
            },
          ],
        },
        {
          sectionKey: "operative_part",
          sectionTitle: "Operative Part",
          sectionText: "The defendant shall pay damages.",
          paragraphs: [
            {
              paragraphText: "The claim is granted in part.",
              rationale: "Supported by the legal analysis and quantified damages.",
              confidenceScore: "0.8",
              annotations: [],
            },
          ],
        },
        {
          sectionKey: "header",
          sectionTitle: "Header",
          sectionText: "District Court — Civil Division",
          paragraphs: [
            {
              paragraphText: "Decision rendered in the name of the law.",
              rationale: "Standard opening formula.",
              confidenceScore: "0.99",
              annotations: [],
            },
          ],
        },
        {
          sectionKey: "issues",
          sectionTitle: "Issues",
          sectionText: "The core issue is whether the delay constituted a material breach.",
          paragraphs: [
            {
              paragraphText: "The court must determine material breach and causation.",
              rationale: "Frames the legal questions for determination.",
              confidenceScore: "0.84",
              annotations: [],
            },
          ],
        },
      ],
    });

    expect(normalizedSections.map(section => section.sectionKey)).toEqual([
      "header",
      "facts",
      "issues",
      "reasoning",
      "operative_part",
    ]);
    expect(normalizedSections.every(section => section.paragraphs.length >= 1)).toBe(true);
  });

  it("rejects AI draft output when a required section is missing", () => {
    expect(() =>
      validateAndNormalizeDraftOutput({
        // caseSummary removed — not part of DraftModelOutput
        sections: [
          {
            sectionKey: "header",
            sectionTitle: "Header",
            sectionText: "Header text",
            paragraphs: [{ paragraphText: "Header paragraph", annotations: [] }],
          },
          {
            sectionKey: "facts",
            sectionTitle: "Facts",
            sectionText: "Facts text",
            paragraphs: [{ paragraphText: "Facts paragraph", annotations: [] }],
          },
          {
            sectionKey: "issues",
            sectionTitle: "Issues",
            sectionText: "Issues text",
            paragraphs: [{ paragraphText: "Issues paragraph", annotations: [] }],
          },
          {
            sectionKey: "operative_part",
            sectionTitle: "Operative Part",
            sectionText: "Operative part text",
            paragraphs: [{ paragraphText: "Operative paragraph", annotations: [] }],
          },
        ],
      }),
    ).toThrow(/Missing required draft section: reasoning/);
  });
});
