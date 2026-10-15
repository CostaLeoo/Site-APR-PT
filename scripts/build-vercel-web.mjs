import { spawnSync } from "node:child_process";

// Public API routing belongs to the root Services configuration on Vercel.
const result = spawnSync(
  process.execPath,
  ["../../node_modules/next/dist/bin/next", "build"],
  {
    stdio: "inherit",
    env: { ...process.env, VERCEL_SERVICES_ROUTING: "true" },
  },
);
process.exit(result.status ?? 1);
