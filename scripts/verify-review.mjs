#!/usr/bin/env node
/**
 * Drives the real UI in headless Chrome over the DevTools protocol to verify
 * the creator -> manager -> creator -> manager review loop and finding waivers.
 *
 * It uploads and analyzes a fresh demo poster first, so it is repeatable.
 * Requires Chrome and the app running:
 *   BASE_URL=http://127.0.0.1:3101 node scripts/verify-review.mjs
 */
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3101";
const CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const DEBUG_PORT = 9223;
const prisma = new PrismaClient();
const results = [];

function record(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(
    `${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`,
  );
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sessionToken(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  assert(user, `missing ${email}; run npm run db:seed`);

  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return token;
}

async function prepareContent(creatorToken) {
  const brand = await prisma.brand.findFirstOrThrow({
    where: { slug: "aurelia-coffee" },
  });
  const buffer = await readFile("public/demo/aurelia-poster.png");

  const form = new FormData();
  form.set("brandId", brand.id);
  form.set(
    "file",
    new File([buffer], `review-loop-${Date.now()}.png`, { type: "image/png" }),
  );

  const headers = { cookie: `vetto_session=${creatorToken}` };
  const upload = await fetch(`${BASE_URL}/api/content`, {
    method: "POST",
    headers,
    body: form,
  });
  assert(upload.status === 200, `upload returned ${upload.status}`);
  const { content } = await upload.json();

  for (const step of ["extract", "analyze"]) {
    const response = await fetch(
      `${BASE_URL}/api/content/${content.id}/${step}`,
      { method: "POST", headers },
    );
    assert(response.status === 200, `${step} returned ${response.status}`);
  }

  const ready = await prisma.content.findUnique({ where: { id: content.id } });
  assert(ready.status === "REVIEW_READY", `status was ${ready.status}`);

  return ready;
}

async function waitForDb(predicate, description, timeoutMs = 20_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await sleep(250);
  }

  throw new Error(`timed out waiting for ${description}`);
}

class Page {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result);
        }
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30_000);
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });

    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text,
      );
    }

    return result.result.value;
  }

  async open(url) {
    await this.send("Page.navigate", { url });
    await this.waitFor("document.readyState === 'complete'");
    await sleep(600);
  }

  async waitFor(predicate, timeoutMs = 20_000) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const value = await this.evaluate(`Boolean(${predicate})`);
      if (value) {
        return;
      }
      await sleep(200);
    }

    const text = await this.evaluate("document.body.innerText.slice(0, 700)");
    throw new Error(`timed out waiting for: ${predicate}\npage text: ${text}`);
  }

  // innerText reflects CSS text-transform, so compare case-insensitively.
  waitForText(text, timeoutMs) {
    return this.waitFor(
      `document.body.innerText.toLowerCase().includes(${JSON.stringify(
        text.toLowerCase(),
      )})`,
      timeoutMs,
    );
  }

  async clickButton(label) {
    await this.waitFor(`[...document.querySelectorAll("button")].some(
      (item) => item.textContent.trim() === ${JSON.stringify(label)} && !item.disabled,
    )`);
    await sleep(150);
    await this.evaluate(`(() => {
      const button = [...document.querySelectorAll("button")].find(
        (item) => item.textContent.trim() === ${JSON.stringify(label)} && !item.disabled,
      );
      if (!button) return false;
      button.click();
      return true;
    })()`);
  }

  /** Clicks a button inside the form that owns the given field id. */
  async clickButtonInForm(fieldId, label) {
    const finder = `(() => {
      const field = document.getElementById(${JSON.stringify(fieldId)});
      const form = field?.closest("form");
      const button = form
        ? [...form.querySelectorAll("button")].find(
            (item) => item.textContent.trim() === ${JSON.stringify(label)} && !item.disabled,
          )
        : null;
      return button;
    })()`;

    // Wait for the submit button to be enabled: after a submitted action React
    // keeps it disabled while the request is in flight.
    await this.waitFor(`${finder} !== null`);
    await sleep(150);
    const clicked = await this.evaluate(`(() => {
      const button = ${finder};
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert(clicked, `could not click "${label}" for #${fieldId}`);
  }

  fill(selector, value) {
    return this.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      const prototype =
        element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(
        element,
        ${JSON.stringify(value)},
      );
      element.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`).then((filled) => {
      assert(filled, `no field ${selector}`);
    });
  }

  select(selector, value) {
    return this.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      ).set.call(element, ${JSON.stringify(value)});
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`).then((selected) => {
      assert(selected, `no select ${selector}`);
    });
  }
}

async function connect() {
  const response = await fetch(
    `http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`,
    { method: "PUT" },
  );
  const target = await response.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  const page = new Page(socket);
  await page.send("Page.enable");
  await page.send("Network.enable");
  return page;
}

async function setSession(page, token) {
  await page.send("Network.clearBrowserCookies");
  await page.send("Network.setCookie", {
    name: "vetto_session",
    value: token,
    domain: new URL(BASE_URL).hostname,
    path: "/",
    httpOnly: true,
  });
}

async function main() {
  const chromePath = CHROME_PATHS.find((candidate) => existsSync(candidate));
  assert(chromePath, "Chrome not found on this machine");

  const profileDir = await mkdtemp(path.join(tmpdir(), "vetto-e2e-"));
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      "--remote-allow-origins=*",
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    let page;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        page = await connect();
        break;
      } catch {
        await sleep(250);
      }
    }
    assert(page, "could not connect to Chrome DevTools");

    await page.open(`${BASE_URL}/login`);
    await page.waitForText("Choose who you are");
    await check("role chooser selects a portal without assigning access", async () => {
      const clicked = await page.evaluate(`(() => {
        const button = [...document.querySelectorAll("button")].find(
          (item) => item.textContent.includes("Manager"),
        );
        if (!button) return false;
        button.click();
        return true;
      })()`);
      assert(clicked, "Manager portal button was not found");
      await page.waitFor(`[...document.querySelectorAll("button")].some(
        (item) => item.textContent.includes("Manager") && item.getAttribute("aria-pressed") === "true",
      )`);
      const guidance = await page.evaluate(`document.body.innerText.includes(
        "Your role is verified from your account after sign-in."
      )`);
      assert(guidance, "server-authenticated role guidance is missing");

      const password =
        process.env.VETTO_E2E_SEED_PASSWORD ??
        process.env.SEED_PASSWORD ??
        "Vetto!Dev123";
      await page.fill('input[name="email"]', "creator@vetto.test");
      await page.fill('input[name="password"]', password);
      const submitted = await page.evaluate(`(() => {
        const form = document.querySelector('input[name="email"]')?.closest("form");
        const button = [...(form?.querySelectorAll("button") ?? [])].find(
          (item) => item.textContent.trim() === "Sign in",
        );
        if (!button) return false;
        button.click();
        return true;
      })()`);
      assert(submitted, "could not submit the email login form");
      await page.waitFor("window.location.pathname === '/dashboard/creator'");
      return "Manager portal selection did not override the authenticated Creator role";
    });

    const creatorToken = await sessionToken("creator@vetto.test");
    const managerToken = await sessionToken("manager@vetto.test");
    const supervisorToken = await sessionToken("supervisor@vetto.test");
    const supervisorUser = await prisma.user.findUniqueOrThrow({
      where: { email: "supervisor@vetto.test" },
      select: { id: true },
    });

    const content = await prepareContent(creatorToken);
    const url = `${BASE_URL}/content/${content.id}`;
    const title = content.title ?? content.originalFilename;

    await setSession(page, creatorToken);
    await page.open(url);
    await page.waitForText(title);

    await check("creator submits content for review", async () => {
      await page.fill(`#submit-review-note-${content.id}`, "Poster v1 ready for review.");
      await page.clickButton("Submit for review");

      const updated = await waitForDb(
        async () => {
          const row = await prisma.content.findUnique({ where: { id: content.id } });
          return row.status === "SUBMITTED" ? row : null;
        },
        "content status SUBMITTED",
      );

      const review = await prisma.review.findFirst({
        where: { contentId: content.id },
        orderBy: { createdAt: "desc" },
        include: { actor: true },
      });

      assert(review?.actor.email === "creator@vetto.test", "submission actor wrong");
      assert(review.comment?.includes("Poster v1"), "submission note not persisted");

      return `status ${updated.status}`;
    });

    await setSession(page, managerToken);
    await page.open(url);
    await page.waitForText("Submitted");

    await check("manager requests changes with a note", async () => {
      await page.fill(
        `#review-note-${content.id}`,
        "Please correct the disclaimer wording and resubmit.",
      );
      await page.clickButton("Request changes");

      const updated = await waitForDb(
        async () => {
          const row = await prisma.content.findUnique({ where: { id: content.id } });
          return row.status === "CHANGES_REQUESTED" ? row : null;
        },
        "content status CHANGES_REQUESTED",
      );

      const review = await prisma.review.findFirst({
        where: { contentId: content.id },
        orderBy: { createdAt: "desc" },
        include: { actor: true },
      });
      assert(review?.actor.email === "manager@vetto.test", "decision actor wrong");

      return `status ${updated.status}`;
    });

    await setSession(page, creatorToken);
    await page.open(url);
    await page.waitForText("Resubmit for review");

    await check("creator resubmits after requested changes", async () => {
      await page.clickButton("Resubmit for review");

      const updated = await waitForDb(
        async () => {
          const row = await prisma.content.findUnique({ where: { id: content.id } });
          return row.status === "SUBMITTED" &&
            row.updatedAt.getTime() > Date.now() - 60_000
            ? row
            : null;
        },
        "content status SUBMITTED after resubmission",
      );

      return `status ${updated.status}`;
    });

    await setSession(page, managerToken);
    await page.open(url);

    await check("manager approves content", async () => {
      await page.fill(`#review-note-${content.id}`, "Approved for the campaign.");
      await page.clickButton("Approve");

      const updated = await waitForDb(
        async () => {
          const row = await prisma.content.findUnique({ where: { id: content.id } });
          return row.status === "APPROVED" ? row : null;
        },
        "content status APPROVED",
      );

      return `status ${updated.status}`;
    });

    await check("Supervisor cannot access approved content before assignment", async () => {
      const pageResponse = await fetch(`${BASE_URL}/content/${content.id}`, {
        headers: { cookie: `vetto_session=${supervisorToken}` },
        redirect: "manual",
      });
      const pageHtml = await pageResponse.text();
      const redirected =
        ((pageResponse.status === 307 || pageResponse.status === 308) &&
          pageResponse.headers.get("location")?.includes("forbidden")) ||
        (pageResponse.status === 200 && pageHtml.includes("/forbidden"));
      assert(redirected, `unassigned detail page did not redirect to forbidden (status ${pageResponse.status})`);
      assert(!pageHtml.includes(content.originalFilename), "unassigned content details leaked into the response");
      const response = await fetch(`${BASE_URL}/api/content/${content.id}/file`, {
        headers: { cookie: `vetto_session=${supervisorToken}` },
      });
      assert(response.status === 403, `expected 403 before assignment, got ${response.status}`);
      return "unassigned file access denied";
    });

    await check("Manager assigns the approved review to a Supervisor", async () => {
      await page.waitForText("Assign secondary review");
      const supervisor = await prisma.user.findUniqueOrThrow({
        where: { email: "supervisor@vetto.test" },
        select: { id: true },
      });
      await page.select(`#supervisor-${content.id}`, supervisor.id);
      await page.clickButton("Assign");
      const assignment = await waitForDb(
        () => prisma.supervisorAssignment.findUnique({ where: { contentId: content.id } }),
        "Supervisor assignment",
      );
      assert(assignment.supervisorId === supervisor.id, "assignment points to the wrong Supervisor");
      return "approved content assigned";
    });

    await check("review history and audit trail persist every step", async () => {
      const reviews = await prisma.review.findMany({
        where: { contentId: content.id },
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { email: true } } },
      });
      const chain = reviews.map(
        (review) => `${review.action}:${review.actor.email}`,
      );
      assert(
        chain.join("|") ===
          "SUBMITTED:creator@vetto.test|CHANGES_REQUESTED:manager@vetto.test|SUBMITTED:creator@vetto.test|APPROVED:manager@vetto.test",
        `unexpected review chain: ${chain.join("|")}`,
      );
      assert(
        reviews.every((review) => review.createdAt instanceof Date),
        "review timestamps missing",
      );

      const audit = await prisma.auditLog.findMany({
        where: { contentId: content.id },
      });
      const actions = audit.map((entry) => entry.action);
      for (const expected of [
        "content.submitted_for_review",
        "content.changes_requested",
        "content.approved",
      ]) {
        assert(actions.includes(expected), `missing audit action ${expected}`);
      }

      return `${reviews.length} review rows, ${audit.length} audit rows`;
    });

    const latestRun = await prisma.analysisRun.findFirstOrThrow({
      where: { contentId: content.id },
      orderBy: { createdAt: "desc" },
      include: { findings: true },
    });
    const finding = latestRun.findings[0];
    assert(finding, "the analysis run produced no findings to triage");

    await setSession(page, supervisorToken);
    await page.open(url);
    await page.waitForText("Findings");
    await page.waitForText("Reviewer triage");

    await check("assigned Supervisor can submit a secondary review", async () => {
      await page.fill(`#review-comment-${content.id}`, "Secondary review complete: manager decision checked.");
      await page.clickButton("Submit review");
      const review = await waitForDb(
        () => prisma.review.findFirst({
          where: { contentId: content.id, action: "SUPERVISOR_REVIEWED", actorId: supervisorUser.id },
          orderBy: { createdAt: "desc" },
        }),
        "Supervisor secondary review",
      );
      const unchanged = await prisma.content.findUniqueOrThrow({ where: { id: content.id } });
      assert(unchanged.status === "APPROVED", "Supervisor changed the Manager's content decision");
      return review.comment ?? "secondary review saved";
    });

    await check("dismissing a finding without a reason is rejected", async () => {
      await page.select(`#finding-status-${finding.id}`, "DISMISSED");
      await page.fill(`#finding-note-${finding.id}`, "");
      await page.clickButtonInForm(`finding-note-${finding.id}`, "Update");
      await page.waitForText("Record why this finding is being dismissed.");

      const unchanged = await prisma.finding.findUnique({
        where: { id: finding.id },
      });
      assert(
        unchanged.status !== "DISMISSED",
        "finding was dismissed without a recorded reason",
      );
    });

    await check("waiver reason is required, stored, and audited", async () => {
      await page.fill(
        `#finding-note-${finding.id}`,
        "Waived: approved by brand lead for this campaign only.",
      );
      await page.clickButtonInForm(`finding-note-${finding.id}`, "Update");

      const updated = await waitForDb(
        async () => {
          const row = await prisma.finding.findUnique({ where: { id: finding.id } });
          return row.status === "DISMISSED" ? row : null;
        },
        "finding status DISMISSED",
      );

      const audit = await prisma.auditLog.findFirst({
        where: { action: "finding.status_updated", entityId: finding.id },
        orderBy: { createdAt: "desc" },
      });
      assert(audit?.metadata?.waiver === true, "waiver flag missing from audit");
      assert(
        typeof audit.metadata?.note === "string" &&
          audit.metadata.note.includes("Waived"),
        "waiver reason missing from audit metadata",
      );

      return `${updated.status} with reason recorded`;
    });

    await check("approved content is locked from further processing", async () => {
      const response = await fetch(
        `${BASE_URL}/api/content/${content.id}/extract`,
        {
          method: "POST",
          headers: { cookie: `vetto_session=${creatorToken}` },
        },
      );
      assert(response.status === 409, `expected 409, got ${response.status}`);
    });

    console.log(
      `\n${results.filter((result) => result.passed).length}/${results.length} checks passed`,
    );
    for (const failed of results.filter((result) => !result.passed)) {
      console.log(`Failed: ${failed.name} — ${failed.detail}`);
    }

    if (results.some((result) => !result.passed)) {
      process.exitCode = 1;
    }
  } finally {
    chrome.kill();
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
