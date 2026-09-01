import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

async function prerender() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("prerender", `${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost:3000/", {
      headers: {
        accept: "text/html",
        host: "localhost:3000",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to prerender page: ${response.status}`);
  }

  const html = await response.text();
  const outputPath = resolve(process.cwd(), "dist", "client", "index.html");
  await writeFile(outputPath, html, "utf-8");
  console.log(`Prerendered static HTML to ${outputPath}`);
}

prerender().catch((err) => {
  console.error("Prerender error:", err);
  process.exit(1);
});
