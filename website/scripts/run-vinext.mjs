import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = process.argv[2];

if (!new Set(["dev", "build", "start"]).has(command)) {
  console.error("Usage: node scripts/run-vinext.mjs <dev|build|start>");
  process.exit(1);
}

const cli = fileURLToPath(new URL("../node_modules/vinext/dist/cli.js", import.meta.url));
const result = spawnSync(process.execPath, [cli, command, ...process.argv.slice(3)], {
  stdio: "inherit",
  env: {
    ...process.env,
    WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH ?? ".wrangler/wrangler.log",
  },
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
