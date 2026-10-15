# Instalação de desenvolvimento

1. Instalar Node 24 e Docker com Compose. Confirmar portas 3000, 4000, 5432 e 8080 livres.
2. Executar `npm ci` na raiz; não dentro de cada aplicação.
3. Executar `npm run setup:local` uma única vez. Não versionar `.env` ou `.local`.
4. Executar `docker compose up -d`; aguardar PostgreSQL saudável e importação do realm no log do Keycloak.
5. Executar `npm run db:generate`, `npm run db:migrate` e `npm run db:seed`.
6. Executar `npm run dev`, abrir `http://localhost:3000` e entrar com uma conta de `.local/demo-access.txt`.
7. Cadastrar TOTP no primeiro login; confirmar que Minha conta mostra MFA confirmado. Se não confirmar, não relaxar a verificação da API: revisar fluxo, ACR e mapeador do IdP.

Use `localhost` consistentemente no navegador. Alterar hostname/porta exige revisar WEB_ORIGIN, API_PUBLIC_ORIGIN, issuer e redirect URI no provedor. Cookie de desenvolvimento não é Secure porque usa loopback HTTP; produção exige HTTPS.

## Sem Docker

A demonstração sem login funciona com `npm run dev -w @apr/web`. O banco local pode ser iniciado por `npm run dev:database` em terminal separado, seguido por migração/seed. Ele ocupa 5432 e não deve competir com o Compose. Para login real ainda é necessário um provedor OIDC compatível; o fixture de teste nunca deve substituir esse provedor em uso normal.

## Banco e mudanças

Migrações numeradas em `database/migrations`. A ferramenta guarda checksum e usa trava de migração. Não editar migrações já aplicadas. Mudanças novas exigem arquivo novo; não executar `prisma db push`.

Ambientes de produção não executam seed fictício. Primeiro operador comercial deve ser cadastrado por processo administrativo controlado no banco usando identidade issuer/sub verificada, não por parâmetro público da aplicação.

Não use `docker compose down -v` para manutenção normal: isso remove volumes. Para parar sem remover dados: `docker compose stop`. As credenciais iniciais do PostgreSQL não são redefinidas ao alterar `.env` em um volume existente.

## Problemas comuns

- API sem configuração: confirmar `.env` na raiz e geração inicial concluída.
- API recusa usuário do banco: usar apr_app; postgres é exclusivo da migração local.
- Login falha: verificar issuer exato, relógio, segredo, callback e disponibilidade do IdP.
- 403 para administrador: verificar MFA real; não fabricar claim ACR estática.
- Sem empresa: obter identificador em Minha conta e solicitar vínculo ao administrador.
- Testes E2E falham ao iniciar: liberar portas 3000/4000 e instalar Chromium via Playwright.
