const { spawnSync } = require("node:child_process");
const { resolve, dirname } = require("node:path");

// Resolve the API's declared tools through Node, without shell PATH or npm prefix assumptions.
const steps = [
  [resolve(dirname(require.resolve("prisma/package.json")), require("prisma/package.json").bin.prisma), "generate", "--schema", resolve(__dirname, "../../database/schema.prisma")],
  [require.resolve("typescript/bin/tsc"), "-p", resolve(__dirname, "tsconfig.json")],
];
for (const args of steps) {
  const result = spawnSync(process.execPath, args, { cwd: __dirname, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
