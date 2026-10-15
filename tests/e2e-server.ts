import { fixture } from "./support/fixture";
async function main() {
  const f = await fixture({
    apiPort: 4000,
    webOrigin: "http://localhost:3000",
    callbackOrigin: "http://localhost:3000",
  });
  console.log("FIXTURE_READY");
  const stop = async () => {
    await f.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
