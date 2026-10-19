# Publicação na Vercel

## Arquitetura escolhida

Um projeto Vercel, com Root Directory na raiz do repositório e dois Services definidos em `vercel.json`:

| Serviço | Pasta | Framework | Rotas públicas |
| --- | --- | --- | --- |
| web | apps/web | Next.js | Páginas e arquivos estáticos |
| api | apps/api | NestJS sobre Express | /auth/*, /v1/*, /health/* |

O backend é NestJS 11 com adaptador Express 5. A Vercel suporta esse framework em Functions, incluindo o entrypoint `src/main.ts` com `app.listen`. O servidor agora respeita `PORT` quando fornecida pela plataforma. Não precisa converter os controllers em rotas Next.js nem criar um handler por endpoint. PostgreSQL, sessões, tentativas OIDC e contadores são externos ao processo. Não há dependência de disco persistente na API atual.

A aplicação Container detectada na raiz é uma alternativa de implantação via Dockerfile; não é um terceiro componente necessário. O arquivo de configuração declara apenas web e api. Docker Compose, PostgreSQL local e Keycloak local não são iniciados pela Vercel.

Services está em beta. Foi escolhido por publicar frontend/backend juntos, com rotas no mesmo domínio e sem proxy HTTP adicional entre projetos. Projetos separados são uma alternativa se a organização não aceitar beta ou precisar de releases e segredos de servidor independentes; nesse caso é necessário configurar o proxy do Next com `API_INTERNAL_ORIGIN`, proteger a API e coordenar os dois deploys. Não misturar essa alternativa com a configuração Services entregue.

Na configuração atual, as rotas do gateway preservam o caminho original e a query do callback. O build específico do web desativa os rewrites locais, evitando chamadas a localhost na nuvem. `npm run build` e `npm run dev` continuam com o comportamento local anterior.

## Configuração na Vercel

### Correção do erro EUSAGE na instalação

O monorepo usa npm Workspaces (`apps/*`) e um único `package-lock.json` versão 3 na raiz. Os manifests dos dois serviços estão registrados nesse lockfile; não criar lockfiles independentes nas subpastas. O gerenciador está identificado como `npm@11.19.0` no `package.json`.

A configuração anterior usava `npm ci --prefix ../..`. Esse caminho é relativo ao diretório de execução, não ao campo `root` do serviço. Quando a instalação parte da raiz do checkout, o prefixo aponta para fora do repositório, onde não existe lockfile, causando EUSAGE. Esse comportamento foi reproduzido localmente mesmo com o lockfile presente na raiz. O trecho do erro remoto não informa o diretório de execução nem os arquivos do commit; portanto, ele sozinho não comprova que o lockfile estava no GitHub. Conferir ambos ao republicar.

Os dois Services agora executam **`npm ci --include=dev`**, sem prefixo: o npm resolve a raiz do workspace, tanto a partir da raiz quanto das pastas `apps/web` e `apps/api`. `--include=dev` mantém TypeScript, Prisma e outras ferramentas de build disponíveis mesmo com NODE_ENV=production. Não há fallback para `npm install`. O prefixo no script de build da API permanece válido: scripts npm rodam no diretório do pacote, portanto ali o caminho da raiz é conhecido.

O lockfile não está bloqueado por `.gitignore` ou `.vercelignore`. O exportador exige a presença dos manifests, do lockfile e de `vercel.json`, e confere as dependências dos três manifests contra o lockfile antes de gerar o ZIP.

Validação em 19/10/2026: cópia de fontes sem `.env` e sem dependências prévias instalada com `npm ci --include=dev` (260 pacotes). Os builds `build:vercel` da API e web passaram nessa cópia, assim como os 30 testes automatizados de autenticação, CSRF, MFA e isolamento multiempresa. O comando de instalação também foi verificado em modo dry-run a partir de cada workspace; ambos resolveram o lockfile da raiz. A demonstração e o formulário APR foram exercitados no Chromium com apenas o servidor de produção Next.js, sem API, PostgreSQL ou OIDC, sem chamadas a `/v1` ou `/auth` e sem erros de JavaScript. Nenhum código funcional ou regra de autenticação foi alterado nesta correção. A confirmação do deploy Linux continua dependendo da próxima execução na Vercel.

Para atualizar um repositório existente, enviar **o conteúdo** de `.local/github-upload-vercel` à raiz do repositório, substituindo os arquivos anteriores; não criar uma pasta `github-upload-vercel` dentro dele. Confirmar no GitHub que `package.json`, `package-lock.json`, `vercel.json` e `apps/` aparecem no mesmo nível. Na Vercel, manter Root Directory `.` e remover overrides antigos de instalação no painel. Depois publicar o commit atualizado sem reutilizar o cache de build da tentativa anterior.

1. Enviar os arquivos atualizados ao GitHub, incluindo `vercel.json`, `.vercelignore`, os dois `package.json`, scripts e código. A cópia em `.local/github-upload-vercel` contém a exportação atualizada, sem dependências e segredos.
2. Importar o repositório como **um projeto**, com **Root Directory = raiz (`.`)**. Usar a configuração Services do arquivo. Remover da seleção automática o serviço Container da raiz; os únicos serviços devem ser `web` e `api`.
3. Selecionar Node.js **24.x**. Não substituir os comandos de build/install do arquivo por um build global nem definir uma pasta de saída global. Cada serviço instala o workspace com o lockfile da raiz. A API gera o Prisma antes de compilar; o web usa `build:vercel`.
4. Definir um domínio canônico HTTPS estável (pode ser o domínio de produção `*.vercel.app`). Usar esse mesmo domínio nas duas variáveis de origem abaixo. Acessar login e painel por ele; aliases diferentes não compartilham cookies host-only.
5. Configurar as variáveis em **Settings → Environment Variables**, no ambiente correto, e fazer novo deploy após mudanças. Habilitar as variáveis de sistema Vercel, incluindo `VERCEL`, usada para reconhecer o cabeçalho de IP confiável da plataforma.
6. Escolher a região das Functions próxima do PostgreSQL. Dimensionar conexões e concorrência com o provedor. Habilitar proteção de previews e regras de Firewall para abuso de login, sem bloquear o callback legítimo.

## Variáveis

Valores abaixo são exemplos, não credenciais. Origens não devem ter caminho nem barra final.

| Variável | Valor/configuração |
| --- | --- |
| NODE_ENV | `production` (também nos previews implantados) |
| WEB_ORIGIN | `https://seu-projeto.vercel.app` ou domínio canônico |
| API_PUBLIC_ORIGIN | **Exatamente o mesmo valor de WEB_ORIGIN** |
| DATABASE_URL | URL PostgreSQL TLS com o usuário restrito `apr_app`, nunca proprietário/admin |
| OIDC_ISSUER | URL HTTPS exata do issuer do provedor, incluindo realm quando aplicável |
| OIDC_CLIENT_ID | ID do cliente OIDC confidencial |
| OIDC_CLIENT_SECRET | Segredo do cliente, no mínimo 16 caracteres; cadastrar como sensível |
| OIDC_MFA_ACR | ACR efetivamente emitido após MFA; padrão `2`, validar no provedor |
| OIDC_ALLOW_LOCAL_HTTP | `false` |
| SESSION_IDLE_SECONDS | `1800` (opcional; faixa 60–3600) |
| SESSION_ABSOLUTE_SECONDS | `28800` (opcional; faixa 60–28800) |

`API_PORT` não é necessário na Vercel. `API_INTERNAL_ORIGIN` não é necessário em Services. `VERCEL_SERVICES_ROUTING` é definido pelo script de build web, sem configuração manual. Não cadastrar nenhuma credencial como `NEXT_PUBLIC_*` nem em `next.config.ts.env`. O browser continua chamando URLs relativas e não recebe credenciais de banco/IdP. Services compartilha variáveis no ambiente servidor do projeto; isso não constitui isolamento de segredos entre os dois runtimes. Não importar módulos da API em componentes do frontend.

`MIGRATION_DATABASE_URL` deve existir apenas no terminal/job administrativo de migrações, fora do runtime Vercel. Não usar a conexão administrativa fornecida por uma integração de banco como `DATABASE_URL` da aplicação.

## Serviços externos e preparação do banco

Necessários: PostgreSQL gerenciado acessível por TLS e um provedor OIDC HTTPS com Authorization Code, PKCE, cliente confidencial e MFA/ACR compatíveis. Keycloak pode ser hospedado em infraestrutura separada. Redis e armazenamento de arquivos não são necessários para as funcionalidades implementadas nesta fase.

1. Criar um banco exclusivo e uma conta administrativa de migração separada. Criar o role `apr_app` com LOGIN, senha forte, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB e NOCREATEROLE. O nome é necessário porque as migrações concedem privilégios a esse role. Não conceder a ele associação ao role proprietário. Conceder CONNECT ao banco se o provedor o exigir.
2. Na raiz do código, em um terminal/job seguro, definir `MIGRATION_DATABASE_URL` para a conexão administrativa **direta** e executar `npm ci`, `npm run db:generate` e `npm run db:migrate`. A conta de migração precisa poder criar tabelas, funções, políticas e conceder os privilégios definidos no SQL. O `infra/postgres/init.sh` é exclusivo do Docker local; não executá-lo no banco gerenciado.
3. Configurar `DATABASE_URL` com `apr_app` e TLS. Limitar o pool Prisma com `connection_limit` na URL conforme capacidade do banco e instâncias simultâneas; começar com um limite pequeno e ajustar com medições. Se usar pooler, ele precisa suportar transações interativas e `SET LOCAL`; não usar pooling por statement. Não desativar TLS nem validações de papel para contornar erros.
4. As políticas RLS, chaves compostas e o contexto de empresa por transação permanecem intactos. A API recusa superuser, BYPASSRLS e usuário proprietário das tabelas. Validar isso também no provedor escolhido.
5. Não rodar `db:seed` em produção: ele cria empresas/usuários fictícios. Para o primeiro operador comercial real, um administrador deve inserir em `platform_operators` o `userId` calculado como SHA-256 hexadecimal de `JSON.stringify([issuer, sub])`, com `issuer` e `sub` reais do IdP. O operador autenticado com MFA poderá provisionar empresas pelo fluxo existente. Esse bootstrap é administrativo, não uma rota pública nem parte do build.

## Identidade e previews

No IdP, cadastrar o redirect URI **exato** `https://seu-dominio/auth/callback`, fluxo Authorization Code com PKCE S256 e o cliente confidencial. Validar assinatura, issuer, ACR e MFA real antes de liberar usuários. Cookies `__Host-`, Secure, HttpOnly e SameSite=Lax, state/nonce, CSRF e expiração foram preservados. Não adicionar curingas de origem ou desabilitar CSRF para corrigir login.

Para homologação, usar domínio estável de staging, banco separado, outro cliente OIDC e variáveis específicas do ambiente/branch. Configurar o callback correspondente. Previews aleatórios não devem receber credenciais de produção nem callback wildcard. Para validar login em staging com Deployment Protection, o navegador precisa ter acesso ao deployment protegido durante ida e volta ao IdP.

## Verificação após publicar

- `/` e `/demonstracao` devem carregar com assets `/_next/*` sem erro.
- `/health/ready` deve responder 200; `/v1/me` sem sessão deve responder 401, nunca HTML do Next.
- Login pelo domínio canônico deve voltar ao mesmo domínio, manter cookies Secure/HttpOnly e abrir `/painel`; validar MFA de perfis privilegiados e logout.
- Confirmar que mutações sem CSRF/origem correta são recusadas e que usuários de uma empresa não acessam outra. Executar em homologação com dados próprios de teste.
- Conferir `Cache-Control: no-store` nas respostas autenticadas e callback, sem regras de CDN que as tornem públicas. Verificar limitação de login e IP do gateway; não habilitar `trust proxy=true` genericamente.
- Conferir logs de cold start, conexão Prisma e permissões RLS; não registrar cookies, tokens ou queries do callback. Testar concorrência e orçamento de conexões antes de ampliar tráfego.

Build local não equivale a deploy remoto. A configuração precisa passar pelo primeiro build Linux da Vercel e pelos testes acima com banco/IdP reais. Migrações são executadas uma vez em job separado, nunca por cold start ou build de preview. A implantação não implementa APR/PT operacionais nem substitui as pendências de homologação já documentadas.

## Referências oficiais consultadas

Verificações locais em 15/10/2026: `build:vercel` da API (incluindo geração Prisma) e do web passaram; `npm run typecheck` passou; 30 testes automatizados e 4 testes de navegador desktop/mobile passaram. O manifesto de rotas do build Services não contém rewrites locais. O fluxo OIDC dos testes usa provedor simulado. Não foi executado deploy remoto nem build pela CLI Vercel; o empacotamento Linux e o gateway Services ainda dependem da primeira implantação na plataforma.

- [Vercel Services (beta)](https://vercel.com/docs/services)
- [Configuração de Services](https://vercel.com/docs/services/config-reference)
- [Roteamento e preservação de caminhos](https://vercel.com/docs/services/routing)
- [NestJS na Vercel](https://vercel.com/docs/frameworks/backend/nestjs)
- [Cabeçalhos confiáveis da Vercel](https://vercel.com/docs/headers/request-headers)

Na sincronização com o GitHub, foram preservados os ajustes de dependências já presentes em main (Prisma no pacote raiz e TypeScript no workspace web), junto com o lockfile correspondente.
