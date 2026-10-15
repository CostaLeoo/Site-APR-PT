# Evidências da entrega — 13/10/2026

Ambiente: Windows, Node 24.21.0; PostgreSQL 17 executado por embedded-postgres. Dados exclusivamente fictícios. Nenhum serviço foi publicado e nenhuma atividade real foi autorizada.

| Verificação | Resultado observado |
|---|---|
| TypeScript da API e frontend | Passou |
| Build NestJS + Next.js | Passou; conferir novamente a cada alteração |
| Integração no PostgreSQL real | 28 testes passaram |
| Navegador Chromium desktop e viewport móvel | 4 testes passaram |
| axe-core na visão geral da demonstração | Sem violações detectadas nas regras WCAG selecionadas, nos dois viewports |
| Auditoria npm após correções | Zero vulnerabilidades reportadas na consulta desta entrega |
| Docker Compose / Dockerfile | Não executados: Docker indisponível no ambiente |
| Keycloak real e MFA físico | Não executados; configuração de desenvolvimento entregue |
| CI no GitHub | Workflow entregue, ainda sem execução remota |
| Teste de intrusão, carga e restauração de produção | Pendentes |

## Cobertura efetiva

Autenticação sem sessão, OIDC com PKCE, nonce/state, assinatura, público e expiração do ID token; replay; sessão/logout; MFA exigido; CSRF; entrada estrita; criação e alteração persistidas; concorrência; RLS sem filtro de ORM; acesso por unidade; FK cruzada; contexto de pool e rollback; separação comercial; desativação de vínculo; privilégios do runtime; digest e imutabilidade administrativa; rate limit; logout após limite; falha real do banco retornando 503.

E2E: demonstração, perguntas e opções em coluna, aviso de resposta incompatível, ausência de liberação, login OIDC via fixture, unidade persistida após reload, consulta de vínculos/auditoria, MFA confirmado pelo fixture e logout.

O provedor em tests/support/fixture.ts é simulado e isolado. A validação OIDC da aplicação é exercitada, mas não se afirma que a integração com Keycloak/provedor comercial foi homologada. A checagem axe cobre a visão geral; outras telas, leitor de tela e condições reais de campo ainda precisam de avaliação.

## Correções encontradas pelos testes

- Contraste insuficiente dos números de atividade e do rodapé corrigido.
- Limite de login estava sendo aplicado ao contador de API no logout; corrigido e adicionado teste de regressão, mantendo saída disponível.
- Digest de auditoria ajustado por migração para corresponder aos dados efetivamente armazenados.
- Configuração da API ajustada para localizar .env na raiz mesmo quando iniciada pelo workspace npm.

## Não coberto nesta fase

APR/PT operacionais, fotografias, assinatura documental, PDF, retenção, pagamentos e sincronização offline ainda não estão implementados. Não existem testes aprovando essas funcionalidades. Revisão normativa é preliminar; aprovação de SST/jurídico e piloto são bloqueios reais para uso operacional.
