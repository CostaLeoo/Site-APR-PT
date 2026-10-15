# Arquitetura e decisões

## ADR-001 — Monólito modular

Next.js no frontend, NestJS na API, PostgreSQL e Prisma. Worker será introduzido com imagens/PDF. Transações e regras ficam no backend. Redis e S3 não são dependências artificiais da fundação; terão integração testada nas fases que os utilizam.

Módulos: identidade, organização, autorização, modelos, APR, PT/PET, evidências, assinaturas, documentos, custódia e comercial. NestJS não autoriza a UI a executar SQL.

## ADR-002 — Multiempresa

Banco compartilhado com tenantId e RLS, conta apr_app sem propriedade/BYPASSRLS. Contexto subject/tenant definido com set_config local à transação. Não usar variável de sessão persistente com pool.

Funções SECURITY DEFINER são restritas a verificar vínculo, operador, criar empresa e retornar cadastro comercial. search_path fixo, execução pública revogada. O proprietário das migrações precisa de BYPASSRLS para essas funções: no Compose de desenvolvimento é postgres. Em produção, criar proprietário dedicado, NOLOGIN e BYPASSRLS, revisar privilégios e não fornecer essa credencial à API.

RLS protege empresas; escopo de unidade e ações são verificados pela API. Não se afirma isolamento criptográfico contra comprometimento completo da API ou do administrador do banco.

## ADR-003 — Identidade

OIDC Authorization Code + PKCE S256, state, nonce, issuer/audience/expiração e assinatura do ID token verificados pela biblioteca. Sessão opaca com hash no banco; tokens do IdP descartados após login. Identidade é hash de issuer+sub, nunca e-mail autoassociado.

MFA depende de ACR emitido pelo fluxo revisado do IdP e validado no servidor. Keycloak local é apenas ambiente de desenvolvimento. Provedor de produção e recuperação de conta exigem decisão posterior.

## ADR-004 — Consistência

Isolamento serializable para alterações autorizadas. version impede atualização perdida. Conflitos retornam 409; não reaplicar automaticamente decisão humana. Requisições de emissão terão chave de idempotência e outbox transacional na Fase 3.

## ADR-005 — Dependências

Node 24, Next 16, Nest 11 e Prisma 6 selecionados e fixados no lockfile. Prisma 8 encontrado como pré-lançamento não foi adotado. embedded-postgres só em desenvolvimento/teste, sem uso em produção. Override deepmerge-ts corrigido exige build e testes após atualizações.

## ADR-006 — Implantação

Execução local autorizada. Nenhuma publicação em hosting externo nesta etapa. Ambientes e contas separados; API privada atrás de gateway TLS; banco sem exposição pública. A infraestrutura comercial será escolhida com custo, residência dos dados e recuperação definidos.
