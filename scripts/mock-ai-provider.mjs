#!/usr/bin/env node
/** Local, key-free OpenAI-compatible provider for deterministic E2E coverage. */
import { createServer } from "node:http";

const port = Number(process.env.VETTO_MOCK_AI_PORT ?? 3102);
let mode = "valid";

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", mode }));
    return;
  }

  if (request.method === "POST" && request.url === "/__mode") {
    let body = "";
    for await (const chunk of request) body += chunk;
    try {
      const value = JSON.parse(body);
      if (!["valid", "malformed", "unavailable"].includes(value.mode)) {
        throw new Error("Unsupported mock mode");
      }
      mode = value.mode;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ mode }));
    } catch (error) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (request.method === "POST" && request.url === "/v1/chat/completions") {
    if (mode === "unavailable") {
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: "mock provider unavailable" } }));
      return;
    }

    let body = "";
    for await (const chunk of request) body += chunk;
    const requestPayload = JSON.parse(body);
    const userPrompt = requestPayload.messages?.find((message) => message.role === "user")?.content ?? "";
    const toneRule = userPrompt.match(/ID: ([^\n]+)\nType: TONE\nCategory: ([^\n]+)\nName: ([^\n]+)/);
    const extractedText = userPrompt.match(/Extracted content text:\n"""\n([\s\S]*?)\n"""/)?.[1] ?? "";
    const quote = extractedText.match(/\S+(?:\s+\S+){0,7}/)?.[0] ?? "";
    const brandVibe = toneRule && quote
      ? {
          score: 78,
          rationale: "The extracted copy matches the configured warm tone.",
          ruleId: toneRule[1],
          quote,
        }
      : null;

    const content = mode === "malformed"
      ? "{ this is not valid JSON"
      : JSON.stringify({
          summary: "Mock review based on supplied extracted evidence.",
          brandVibe,
          findings: [],
        });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content } }] }));
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Mock AI provider listening on 127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
