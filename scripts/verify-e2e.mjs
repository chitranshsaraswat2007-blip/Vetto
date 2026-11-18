#!/usr/bin/env node
/**
 * Role-based end-to-end verification against a running VETTO server.
 *
 * Usage:
 *   npm run build && npm run start -- -p 3100
 *   BASE_URL=http://127.0.0.1:3100 node scripts/verify-e2e.mjs
 *
 * It creates real sessions, uploads the demo image/PDF/DOCX, runs extraction and
 * analysis through the HTTP API, and asserts role-based access plus persisted
 * records. It exits non-zero if any check fails.
 */
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

import { PrismaClient } from "@prisma/client";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3101";
const AI_MOCK_CONTROL_URL = process.env.VETTO_E2E_AI_CONTROL_URL;
const prisma = new PrismaClient();
const results = [];

function record(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    record(name, true, typeof detail === "string" ? detail : "");
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Returns true when the response either redirects or streams a redirect
 * instruction (Partial Prerendering serves the shell with 200 and then
 * performs the redirect during streaming).
 */
async function redirectsTo(response, target) {
  if (response.status === 307 || response.status === 302) {
    return (response.headers.get("location") ?? "").includes(target);
  }

  const body = await response.text();

  return response.status === 200 && body.includes(target);
}

/** Fails if any marker that only appears inside a protected page is present. */
async function expectDenied(response, target, pageMarkers) {
  const body = await response.clone().text();
  const redirected = await redirectsTo(response, target);

  assert(
    redirected,
    `expected a redirect to ${target}, got ${response.status} with no redirect payload`,
  );

  for (const marker of pageMarkers) {
    assert(
      !body.includes(marker),
      `unauthorized response leaked protected page content (${marker})`,
    );
  }
}

async function sessionFor(email) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error(
      `Missing ${email}. Run "npm run db:seed" before verifying.`,
    );
  }

  const token = randomBytes(32).toString("base64url");

  await prisma.session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return {
    user,
    headers: { cookie: `vetto_session=${token}` },
  };
}

async function get(path, session) {
  return fetch(`${BASE_URL}${path}`, {
    headers: session.headers,
    redirect: "manual",
  });
}

async function post(path, session, body) {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: session.headers,
    body,
    redirect: "manual",
  });
}

async function upload(session, { brandId, buffer, name, type }) {
  const form = new FormData();
  form.set("brandId", brandId);
  form.set("file", new File([buffer], name, { type }));

  const response = await post("/api/content", session, form);
  const payload = await response.json().catch(() => ({}));

  return { response, payload };
}

async function processContent(session, contentId) {
  const extract = await post(`/api/content/${contentId}/extract`, session, null);
  const extractPayload = await extract.json().catch(() => ({}));

  const analyze = await post(`/api/content/${contentId}/analyze`, session, null);
  const analyzePayload = await analyze.json().catch(() => ({}));

  return {
    extract: { status: extract.status, payload: extractPayload },
    analyze: { status: analyze.status, payload: analyzePayload },
  };
}

async function setMockAiMode(mode) {
  if (!AI_MOCK_CONTROL_URL) return;

  const response = await fetch(AI_MOCK_CONTROL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  assert(response.ok, `mock AI mode change returned ${response.status}`);
}

async function main() {
  const health = await fetch(`${BASE_URL}/api/health`);
  assert(health.ok, `Health endpoint returned ${health.status}`);

  const brand = await prisma.brand.findFirst({ where: { slug: "aurelia-coffee" } });
  assert(brand, "Demo brand aurelia-coffee is missing; run npm run db:seed");

  const creator = await sessionFor("creator@vetto.test");
  const manager = await sessionFor("manager@vetto.test");
  const supervisor = await sessionFor("supervisor@vetto.test");
  const admin = await sessionFor("admin@vetto.test");

  const posterPath = process.env.VETTO_E2E_IMAGE ?? "public/demo/aurelia-poster.png";
  const pdfPath = process.env.VETTO_E2E_PDF ?? "public/demo/aurelia-offer.pdf";
  const docxPath = process.env.VETTO_E2E_DOCX ?? "public/demo/aurelia-brief.docx";
  const webpPath = process.env.VETTO_E2E_WEBP;
  const poster = await readFile(posterPath);
  const pdf = await readFile(pdfPath);
  const docx = await readFile(docxPath);
  const webp = webpPath ? await readFile(webpPath) : null;

  await check("unauthenticated dashboard redirects to /login", async () => {
    const response = await fetch(`${BASE_URL}/dashboard`, { redirect: "manual" });
    await expectDenied(response, "/login", ["My Work"]);
    return `status ${response.status}`;
  });

  await check("login shows all four role choices", async () => {
    const response = await fetch(`${BASE_URL}/login`);
    assert(response.status === 200, `expected 200, got ${response.status}`);
    const html = await response.text();
    for (const role of ["Creator", "Manager", "Supervisor", "Admin"]) {
      assert(html.includes(role), `login role choice missing: ${role}`);
    }
    assert(html.includes("Choose who you are"), "role chooser heading missing");
  });

  await check("creator dashboard is the creator view", async () => {
    const response = await get("/dashboard/creator", creator);
    assert(response.status === 200, `expected 200, got ${response.status}`);
    const html = await response.text();
    assert(html.includes("My Work"), "creator dashboard copy missing");
  });

  await check("creator cannot open user management", async () => {
    const response = await get("/users", creator);
    await expectDenied(response, "/forbidden", [
      "Add a member",
      "Workspace users",
    ]);
    return `status ${response.status}`;
  });

  await check("creator cannot open workspace settings", async () => {
    const response = await get("/settings", creator);
    await expectDenied(response, "/forbidden", [
      "System readiness",
      "Runtime details",
    ]);
    return `status ${response.status}`;
  });

  await check("manager review queue loads", async () => {
    const response = await get("/reviews", manager);
    assert(response.status === 200, `expected 200, got ${response.status}`);
  });

  await check("manager cannot create brands", async () => {
    const response = await get("/brands/new", manager);
    await expectDenied(response, "/forbidden", ["Brand profile"]);
    return `status ${response.status}`;
  });

  await check("manager sees brands read-only", async () => {
    const response = await get("/brands", manager);
    assert(response.status === 200, `expected 200, got ${response.status}`);
    const html = await response.text();
    assert(html.includes("Read-only access"), "read-only badge missing");
  });

  await check("manager cannot upload content", async () => {
    const { response } = await upload(manager, {
      brandId: brand.id,
      buffer: poster,
      name: "aurelia-poster.png",
      type: "image/png",
    });
    assert(response.status === 403, `expected 403, got ${response.status}`);
  });

  await check("admin settings and users load", async () => {
    const settings = await get("/settings", admin);
    const users = await get("/users", admin);
    assert(settings.status === 200, `/settings returned ${settings.status}`);
    assert(users.status === 200, `/users returned ${users.status}`);
  });

  await check("supervisor triage dashboard loads", async () => {
    const response = await get("/dashboard/supervisor", supervisor);
    assert(response.status === 200, `expected 200, got ${response.status}`);
    const html = await response.text();
    assert(
      html.includes("Block-Severity Findings"),
      "supervisor dashboard still labels findings as escalations",
    );
  });

  const uploaded = [];

  await setMockAiMode("valid");

  for (const [label, file] of [
    ["PNG image", { buffer: poster, name: posterPath.split(/[\\/]/).pop(), type: "image/png" }],
    ["PDF", { buffer: pdf, name: pdfPath.split(/[\\/]/).pop(), type: "application/pdf" }],
    [
      "DOCX",
      {
        buffer: docx,
        name: docxPath.split(/[\\/]/).pop(),
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    ],
    ...(webp
      ? [["WEBP image", { buffer: webp, name: webpPath.split(/[\\/]/).pop(), type: "image/webp" }]]
      : []),
  ]) {
    await check(`creator uploads and processes ${label}`, async () => {
      const uploadStartedAt = performance.now();
      const { response, payload } = await upload(creator, {
        brandId: brand.id,
        ...file,
      });
      const uploadMs = Math.round(performance.now() - uploadStartedAt);
      assert(response.status === 200, `upload returned ${response.status}`);
      assert(payload.content?.id, "upload response had no content id");

      const contentId = payload.content.id;
      uploaded.push({ label, contentId, kind: payload.content.kind });

      const extractionStartedAt = performance.now();
      const { extract, analyze } = await processContent(creator, contentId);
      const processMs = Math.round(performance.now() - extractionStartedAt);
      assert(
        extract.status === 200,
        `extract returned ${extract.status}: ${JSON.stringify(extract.payload)}`,
      );
      assert(
        analyze.status === 200,
        `analyze returned ${analyze.status}: ${JSON.stringify(analyze.payload)}`,
      );

      const content = await prisma.content.findUnique({
        where: { id: contentId },
        include: {
          extraction: true,
          analysisRuns: { orderBy: { createdAt: "desc" }, take: 1, include: { findings: true } },
        },
      });
      assert(content?.status === "REVIEW_READY", `status was ${content?.status}`);
      assert(content.extraction?.status === "COMPLETED", "extraction not completed");
      const run = content.analysisRuns[0];
      assert(run?.status === "COMPLETED", "analysis run not completed");
      assert(
        run.overallScore !== null,
        "overall score missing for a processed asset",
      );
      if (AI_MOCK_CONTROL_URL) {
        const ai = run.metadata?.ai;
        assert(ai?.status === "completed", `valid mock AI response was ${ai?.status}`);
        assert(run.brandVibeScore !== null, "valid mock AI score was not persisted");
      }
      if (label === "PNG image") {
        assert(
          run.metadata?.logo?.status !== "no-approved-logo",
          "seeded approved logo asset could not be loaded",
        );
        assert((content.extraction.text ?? "").length > 40, "large poster OCR returned too little text");
      }
      if (label === "PDF" || label === "DOCX") {
        assert(
          content.extraction.text?.includes("[Extraction truncated]"),
          `${label} extraction did not report text truncation`,
        );
      }

      return `${payload.content.kind}, ${(file.buffer.byteLength / (1024 * 1024)).toFixed(2)} MiB, upload ${uploadMs} ms, extract+analyze ${processMs} ms, ${run.findings.length} findings, score ${run.overallScore}, ${content.extraction.text?.length ?? 0} chars`;
    });
  }

  const imageContent = uploaded.find((item) => item.label === "PNG image");
  const pdfContent = uploaded.find((item) => item.label === "PDF");

  if (AI_MOCK_CONTROL_URL) {
    await check("malformed AI output preserves deterministic analysis", async () => {
      await setMockAiMode("malformed");
      const response = await post(
        `/api/content/${imageContent.contentId}/analyze`,
        creator,
        null,
      );
      const payload = await response.json().catch(() => ({}));
      assert(response.status === 200, `analyze returned ${response.status}`);
      assert(payload.analysis?.aiStatus === "failed", `AI status was ${payload.analysis?.aiStatus}`);

      const latest = await prisma.analysisRun.findFirst({
        where: { contentId: imageContent.contentId },
        orderBy: { createdAt: "desc" },
        include: { findings: true },
      });
      assert(latest?.status === "COMPLETED", `run status was ${latest?.status}`);
      assert(latest.deterministicCompletedAt, "deterministic completion timestamp missing");
      assert(latest.metadata?.ai?.status === "failed", "malformed AI status was not saved");
      assert(latest.overallScore !== null, "deterministic overall score was lost");
      assert(
        latest.findings.every((finding) => finding.source === "DETERMINISTIC"),
        "unvalidated AI findings were persisted",
      );
      return `run completed with ${latest.findings.length} deterministic findings; malformed AI output was rejected`;
    });
    await check("AI provider outage preserves deterministic analysis", async () => {
      await setMockAiMode("unavailable");
      const response = await post(
        `/api/content/${imageContent.contentId}/analyze`,
        creator,
        null,
      );
      const payload = await response.json().catch(() => ({}));
      assert(response.status === 200, `analyze returned ${response.status}`);
      assert(payload.analysis?.aiStatus === "failed", `AI status was ${payload.analysis?.aiStatus}`);

      const latest = await prisma.analysisRun.findFirst({
        where: { contentId: imageContent.contentId },
        orderBy: { createdAt: "desc" },
        include: { findings: true },
      });
      assert(latest?.status === "COMPLETED", `run status was ${latest?.status}`);
      assert(latest.deterministicCompletedAt, "deterministic completion timestamp missing");
      assert(latest.overallScore !== null, "deterministic overall score was lost");
      return "HTTP 503 from the AI provider did not block the deterministic score or findings";
    });
    await setMockAiMode("valid");
  }

  await check("creator downloads own original file", async () => {
    const response = await get(`/api/content/${imageContent.contentId}/file`, creator);
    assert(response.status === 200, `expected 200, got ${response.status}`);
    assert(
      response.headers.get("content-type") === "image/png",
      `unexpected content type ${response.headers.get("content-type")}`,
    );
  });

  await check("PDF extraction marks visual checks unavailable", async () => {
    const content = await prisma.content.findUnique({
      where: { id: pdfContent.contentId },
      include: { analysisRuns: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const limitations = content.analysisRuns[0]?.metadata?.limitations ?? [];
    assert(
      limitations.some((item) => /Visual checks are limited to uploaded images/.test(item)),
      "document limitation text missing",
    );
    assert(content.analysisRuns[0]?.visualQualityScore === null, "visual score should be unscored for PDFs");
  });

  await check("unauthenticated file request is rejected", async () => {
    const response = await fetch(
      `${BASE_URL}/api/content/${imageContent.contentId}/file`,
      { redirect: "manual" },
    );
    assert(response.status === 401, `expected 401, got ${response.status}`);
  });

  await check("unknown content id returns 404, not a file", async () => {
    const response = await get("/api/content/does-not-exist/file", creator);
    assert(response.status === 404, `expected 404, got ${response.status}`);
  });

  await check("unsupported file type is rejected", async () => {
    const { response, payload } = await upload(creator, {
      brandId: brand.id,
      buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
      name: "evil.svg",
      type: "image/svg+xml",
    });
    assert(response.status === 415, `expected 415, got ${response.status}`);
    return payload.error;
  });

  await check("oversized upload is rejected", async () => {
    const oversized = Buffer.alloc(21 * 1024 * 1024, 1);
    const { response, payload } = await upload(creator, {
      brandId: brand.id,
      buffer: oversized,
      name: "huge.png",
      type: "image/png",
    });
    assert(response.status === 413, `expected 413, got ${response.status}`);
    return payload.error;
  });

  await check("archived brand cannot receive content", async () => {
    const archived = await prisma.brand.create({
      data: {
        name: "Verification Archive",
        slug: `verification-archive-${Date.now()}`,
        status: "ARCHIVED",
        createdById: admin.user.id,
      },
    });

    const { response } = await upload(creator, {
      brandId: archived.id,
      buffer: poster,
      name: "aurelia-poster.png",
      type: "image/png",
    });
    assert(response.status === 400, `expected 400, got ${response.status}`);
    await prisma.brand.delete({ where: { id: archived.id } });
  });

  await check("creator cannot read another user's content", async () => {
    const { response, payload } = await upload(admin, {
      brandId: brand.id,
      buffer: poster,
      name: "admin-poster.png",
      type: "image/png",
    });
    assert(response.status === 200, `admin upload returned ${response.status}`);

    const adminContentId = payload.content.id;
    const page = await get(`/content/${adminContentId}`, creator);
    await expectDenied(page, "/forbidden", ["Source file", "Review history"]);

    const file = await get(`/api/content/${adminContentId}/file`, creator);
    assert(file.status === 403, `file download returned ${file.status}`);

    await prisma.content.delete({ where: { id: adminContentId } });
  });

  await check("audit log records uploads with actor and timestamp", async () => {
    const entries = await prisma.auditLog.findMany({
      where: { action: "content.uploaded", contentId: imageContent.contentId },
      include: { actor: { select: { email: true } } },
    });
    assert(entries.length === 1, `expected 1 upload audit row, found ${entries.length}`);
    assert(
      entries[0].actor?.email === "creator@vetto.test",
      `unexpected actor ${entries[0].actor?.email}`,
    );
    assert(entries[0].createdAt instanceof Date, "audit timestamp missing");
  });

  await check("submitted content is locked from reprocessing", async () => {
    await prisma.content.update({
      where: { id: imageContent.contentId },
      data: { status: "SUBMITTED" },
    });

    const extract = await post(`/api/content/${imageContent.contentId}/extract`, creator, null);
    assert(extract.status === 409, `expected 409, got ${extract.status}`);

    await prisma.content.update({
      where: { id: imageContent.contentId },
      data: { status: "REVIEW_READY" },
    });
  });

  const contentIds = {
    image: imageContent.contentId,
    pdf: pdfContent.contentId,
    docx: uploaded.find((item) => item.label === "DOCX").contentId,
  };

  for (const item of results.filter((result) => !result.passed)) {
    console.log(`\nFailed: ${item.name} — ${item.detail}`);
  }

  console.log(`\n${results.filter((r) => r.passed).length}/${results.length} checks passed`);
  console.log(`CONTENT_IDS=${JSON.stringify(contentIds)}`);

  await prisma.$disconnect();

  if (results.some((result) => !result.passed)) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
