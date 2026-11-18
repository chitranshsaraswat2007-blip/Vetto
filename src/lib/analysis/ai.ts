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
    })
    .nullable(),
  findings: z
    .array(
      z.object({
        title: z.string().min(3).max(160),
        description: z.string().min(3).max(1000),
        recommendation: z.string().max(600).optional(),
        severity: z.enum(["LOW", "MEDIUM"]),
        category: z.enum(["BRAND_VIBE", "CONTENT", "BRAND_IDENTITY"]),
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
      findings: DraftFinding[];
      model: string;
    };

export function isAiConfigured() {
  return Boolean(process.env.AI_API_KEY);
}

export async function analyzeWithAi({
  brand,
  extraction,
  deterministicFindings,
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
    textExcerpt
      ? `Extracted content text:\n"""\n${textExcerpt}\n"""`
      : "Extracted content text: unavailable",
  ]
    .filter(Boolean)
    .join("\n\n");

  const systemPrompt = [
    "You are a careful brand governance analyst for VETTO.",
    "Assess tone and brand voice using only the supplied text and metadata.",
    "You cannot see the image. Never claim to observe layout, imagery, colors, or logo placement that is not present in the supplied metadata.",
    "Do not restate or duplicate deterministic findings.",
    "Do not give legal advice. Keep findings evidence-based; if the extracted text is too short or unavailable, return brandVibe null and an empty findings array.",
    "Severities are limited to LOW or MEDIUM. Use LOW for stylistic observations and MEDIUM for meaningful brand-voice problems.",
    'Respond with strict JSON only: {"summary": string, "brandVibe": {"score": number, "rationale": string} | null, "findings": [{"title": string, "description": string, "recommendation": string, "severity": "LOW"|"MEDIUM", "category": "BRAND_VIBE"|"CONTENT"|"BRAND_IDENTITY"}]}',
  ].join(" ");

  const response = await fetch(`${baseUrl}/chat/completions`, {
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

  const findings: DraftFinding[] = parsed.data.findings.map((finding) => ({
    ruleId: null,
    category: finding.category,
    source: "AI",
    severity: finding.severity,
    title: finding.title,
    description: finding.description,
    recommendation: finding.recommendation ?? null,
    evidence: null,
    confidence: 0.6,
  }));

  return {
    status: "completed",
    summary: parsed.data.summary,
    brandVibeScore: parsed.data.brandVibe
      ? Math.round(parsed.data.brandVibe.score)
      : null,
    brandVibeRationale: parsed.data.brandVibe?.rationale ?? null,
    findings,
    model,
  };
}
