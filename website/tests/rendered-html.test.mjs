import assert from "node:assert/strict";
import test from "node:test";

function expectedSiteOrigin() {
  const configuredOrigin = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;

  if (configuredOrigin) {
    try {
      const url = new URL(configuredOrigin);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin;
      }
    } catch {
      // Invalid configuration falls back to the application's safe local origin.
    }
  }

  return "http://localhost:3000";
}

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://attacker.invalid/", {headers:{accept:"text/html",host:"attacker.invalid","x-forwarded-host":"attacker.invalid"}}), {ASSETS:{fetch:async()=>new Response("Not found",{status:404})}}, {waitUntil(){},passThroughOnException(){}});
}

test("server-renders the Development Kit launch page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Development Kit Framework/);
  assert.match(html, /Ship software with discipline, not drift/);
  assert.match(html, /UNDERSTAND/);
  assert.match(html, /COMPLETE/);
  assert.match(html, /npx development-kit init --opencode/);
  assert.match(html, /Skip to content/);
  assert.ok(
    html.includes(`property="og:image" content="${expectedSiteOrigin()}/og.png"`),
    "uses the normalized configured site origin for Open Graph metadata",
  );
  assert.match(html, /property="og:image:width" content="1731"/);
  assert.match(html, /property="og:image:height" content="909"/);
  assert.match(html, /aria-label="Primary"/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /attacker\.invalid/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|_sites-preview/);
});
