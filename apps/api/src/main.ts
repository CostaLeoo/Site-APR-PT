import { readConfig } from "./config";
import { createApp } from "./app";
async function main() {
  const config = readConfig();
  const { app } = await createApp(config);
  await app.listen(process.env.PORT ?? config.API_PORT, "0.0.0.0");
  console.log(`API disponível na porta ${config.API_PORT}`);
}
main().catch(() => {
  console.error(
    "Falha ao iniciar. Verifique configuração, migrações e permissões do banco.",
  );
  process.exitCode = 1;
});
