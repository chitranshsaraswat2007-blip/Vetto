import "server-only";

import { z } from "zod";

import type { DraftFinding } from "@/lib/analysis/deterministic";
import type { ExtractionData } from "@/lib/extraction/types";

const aiResponseSchema = z.object({
  summary: z.string().max(1200),
  brandVibe: z
    .object({
      score: z.number().min(0).max(100),
      rationale: z.string().max(800),
      ruleId: z.string().min(1).max(64),
      quote: z.string().min(1).max(300),
    })
    .nullable(),
  findings: z
    .array(
      z.object({
        ruleId: z.string().min(1).max(64),
        quote: z.string().min(1).max(300),
        title: z.string().min(3).max(160),
        description: z.string().min(3).max(1000),
        recommendation: z.string().max(600).optional(),
        severity: z.enum(["LOW", "MEDIUM"]),
      }),
    )
    .max(4),
});

export type AiAnalysisResult =
  | { status: "not-configured" }
  | {
      status: "completed";
      summary: string;
      brandVibeScore: number | null;
      brandVibeRationale: string | null;
      brandVibeEvidence: { ruleId: string; ruleName: string; quote: string } | null;
      findings: DraftFinding[];
      model: string;
    };

export function isAiConfigured() {
  return Boolean(process.env.AI_API_KEY);
}

type AiRule = {
  id: string;
  name: string;
  category: string;
  ruleType: string;
  severity: string;
  description: string;
  pattern: string | null;
  keyword: string | null;
  isActive: boolean;
};

function selectRelevantRules(rules: AiRule[], contentText: string) {
  const tokens = new Set(contentText.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);

  const ranked = rules
    .filter(
      (rule) =>
        rule.isActive &&
        (rule.ruleType === "TONE" || rule.ruleType === "CLAIM_RESTRICTION"),
    )
    .map((rule) => {
      const ruleTokens = new Set(
        [rule.name, rule.description, rule.keyword, rule.pattern]
          .filter((part): part is string => Boolean(part))
          .join(" ")
          .toLowerCase()
          .match(/[\p{L}\p{N}]{3,}/gu) ?? [],
      );
      const overlap = [...ruleTokens].filter((token) => tokens.has(token)).length;
      return { rule, score: overlap + (rule.ruleType === "TONE" ? 2 : 0) };
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.rule.name.localeCompare(right.rule.name),
    );
  const strongestToneRule = ranked.find(({ rule }) => rule.ruleType === "TONE");
  const selected = strongestToneRule
    ? [strongestToneRule, ...ranked.filter(({ rule }) => rule.id !== strongestToneRule.rule.id)]
    : ranked;

  return selected.slice(0, 12).map(({ rule }) => rule);
}

function isTimeoutError(error: unknown) {
  if (error instanceof Error && error.name === "TimeoutError") {
    return true;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.toLowerCase().includes("aborted due to timeout")
  );
}

export async function analyzeWithAi({
  brand,
  extraction,
  deterministicFindings,
  rules,
}: {
  brand: {
    name: string;
    description: string | null;
    profile: {
      description: string | null;
      personality: string[];
      tone: string | null;
      visualStyle: string | null;
      imageryStyle: string | null;
      designDirection: string | null;
    } | null;
    colors: Array<{ hex: string; name: string | null }>;
    fonts: string[];
  };
  extraction: { text: string; data: ExtractionData | null };
  deterministicFindings: DraftFinding[];
  rules: AiRule[];
}): Promise<AiAnalysisResult> {
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    return { status: "not-configured" };
  }

  const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  );
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  const textExcerpt = extraction.text.slice(0, 8000);
  const relevantRules = selectRelevantRules(rules, textExcerpt);
  const ruleContext = relevantRules
    .map(
      (rule) =>
        `ID: ${rule.id}\nType: ${rule.ruleType}\nCategory: ${rule.category}\nName: ${rule.name}\nGuidance: ${rule.description}${rule.keyword ? `\nKeyword: ${rule.keyword}` : ""}${rule.pattern ? `\nPattern: ${rule.pattern}` : ""}`,
    )
    .join("\n\n");
  const deterministicSummary = deterministicFindings
    .slice(0, 12)
    .map(
      (finding) =>
        `- [${finding.severity}/${finding.category}] ${finding.title}`,
    )
    .join("\n");

  const prompt = [
    `Brand: ${brand.name}`,
    brand.description ? `Brand description: ${brand.description}` : "",
    brand.profile?.description
      ? `Brand narrative: ${brand.profile.description}`
      : "",
    brand.profile?.personality.length
      ? `Personality: ${brand.profile.personality.join(", ")}`
      : "",
    brand.profile?.tone ? `Tone: ${brand.profile.tone}` : "",
    brand.profile?.visualStyle
      ? `Visual style: ${brand.profile.visualStyle}`
      : "",
    brand.profile?.imageryStyle
      ? `Imagery style: ${brand.profile.imageryStyle}`
      : "",
    brand.profile?.designDirection
      ? `Design direction: ${brand.profile.designDirection}`
      : "",
    brand.colors.length
      ? `Approved colors: ${brand.colors
          .map((color) => `${color.hex}${color.name ? ` (${color.name})` : ""}`)
          .join(", ")}`
      : "Approved colors: none configured",
    brand.fonts.length
      ? `Approved fonts: ${brand.fonts.join(", ")}`
      : "Approved fonts: none configured",
    `Content type: ${extraction.data?.kind ?? "unknown"}`,
    extraction.data?.ocrConfidence !== undefined
      ? `OCR confidence: ${extraction.data.ocrConfidence}`
      : "",
    extraction.data?.dominantColors?.length
      ? `Dominant colors: ${extraction.data.dominantColors
          .map((color) => `${color.hex} ${color.percentage}%`)
          .join(", ")}`
      : "",
    deterministicSummary
      ? `Deterministic findings already reported (do not repeat):\n${deterministicSummary}`
      : "Deterministic findings: none",
    ruleContext
      ? `Relevant active tone and claim rules (only these rules may support an AI finding):\n${ruleContext}`
      : "Relevant active tone and claim rules: none. Do not return any AI findings.",
    textExcerpt
      ? `Extracted content text:\n"""\n${textExcerpt}\n"""`
      : "Extracted content text: unavailable",
  ]
    .filter(Boolean)
    .join("\n\n");

  const systemPrompt = [
    "You are a careful brand governance analyst for VETTO.",
    "Assess claim meaning and tone/brand voice using only the supplied extracted text, brand profile, and relevant active rules.",
    "You cannot see the image. Never claim to observe layout, imagery, colors, or logo placement that is not present in the supplied metadata.",
    "Do not restate or duplicate deterministic findings.",
    "Every finding and non-null brandVibe assessment must cite one supplied active rule ID and copy an exact, contiguous quote from the extracted content. If you cannot do both, omit the finding or return brandVibe null. Never invent a rule or quote.",
    "Only report claim or tone issues covered by a supplied CLAIM_RESTRICTION or TONE rule. Do not give legal advice. If the extracted text is too short or no relevant rules are supplied, return brandVibe null or an empty findings array as appropriate.",
    "Severities are limited to LOW or MEDIUM. Use LOW for stylistic observations and MEDIUM for meaningful rule violations.",
    'Respond with strict JSON only: {"summary": string, "brandVibe": {"score": number, "rationale": string, "ruleId": string, "quote": string} | null, "findings": [{"ruleId": string, "quote": string, "title": string, "description": string, "recommendation": string, "severity": "LOW"|"MEDIUM"}]}',
  ].join(" ");

  const requestCompletion = () =>
    fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        // The response schema allows a long summary plus four findings, which
        // does not fit in 900 tokens and would truncate the JSON.
        max_tokens: 2000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

  let response: Response;
  try {
    response = await requestCompletion();
  } catch (error) {
    if (!isTimeoutError(error)) {
      throw error;
    }

    // Providers occasionally stall on a cold or overloaded first request.
    // Retry once so a transient timeout does not require a manual re-analysis.
    await new Promise((resolve) => setTimeout(resolve, 250));
    response = await requestCompletion();
  }

  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 300);
    throw new Error(
      `AI provider returned ${response.status}: ${errorText || "no details"}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI provider returned an empty response.");
  }

  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const parsed = aiResponseSchema.safeParse(JSON.parse(cleaned));

  if (!parsed.success) {
    throw new Error(
      `AI response did not match the expected schema: ${
        parsed.error.issues[0]?.message ?? "unknown validation error"
      }`,
    );
  }

  const ruleById = new Map(relevantRules.map((rule) => [rule.id, rule]));
  const deterministicRuleIds = new Set(
    deterministicFindings
      .map((finding) => finding.ruleId)
      .filter((ruleId): ruleId is string => ruleId !== null),
  );
  const findings: DraftFinding[] = parsed.data.findings.flatMap((finding) => {
    const rule = ruleById.get(finding.ruleId);
    const quoteIsPresent = extraction.text
      .toLocaleLowerCase()
      .includes(finding.quote.toLocaleLowerCase());

    if (
      !rule ||
      !quoteIsPresent ||
      deterministicRuleIds.has(rule.id) ||
      (rule.ruleType !== "TONE" && rule.ruleType !== "CLAIM_RESTRICTION")
    ) {
      return [];
    }

    return [{
      ruleId: rule.id,
      category: rule.category,
      source: "AI" as const,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      recommendation: finding.recommendation ?? null,
      evidence: {
        quote: finding.quote,
        source: "extracted_text",
        ruleId: rule.id,
        ruleName: rule.name,
      },
      confidence: 0.6,
    }];
  });
  const vibeRule = parsed.data.brandVibe
    ? ruleById.get(parsed.data.brandVibe.ruleId)
    : undefined;
  const vibeQuoteIsPresent = parsed.data.brandVibe
    ? extraction.text
        .toLocaleLowerCase()
        .includes(parsed.data.brandVibe.quote.toLocaleLowerCase())
    : false;
  const brandVibeIsVerified = Boolean(
    parsed.data.brandVibe &&
      vibeRule?.ruleType === "TONE" &&
      vibeQuoteIsPresent,
  );

  return {
    status: "completed",
    summary: parsed.data.summary,
    brandVibeScore: brandVibeIsVerified && parsed.data.brandVibe
      ? Math.round(parsed.data.brandVibe.score)
      : null,
    brandVibeRationale: brandVibeIsVerified
      ? parsed.data.brandVibe?.rationale ?? null
      : null,
    brandVibeEvidence:
      brandVibeIsVerified && parsed.data.brandVibe && vibeRule
        ? {
            ruleId: vibeRule.id,
            ruleName: vibeRule.name,
            quote: parsed.data.brandVibe.quote,
          }
        : null,
    findings,
    model,
  };
}
