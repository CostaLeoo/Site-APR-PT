# API da fundação — v1

OpenAPI interativo: `/api-docs` e JSON `/api-docs-json`, apenas fora de produção. Nenhuma rota de APR/PT operacional existe nesta fase.

Cookies de sessão são opacos e HttpOnly; nome de produção `__Host-apr_session`. Não enviar identidade ou papel como substituto de autenticação. `GET /v1/me` retorna token CSRF; mutações exigem `Origin` igual a WEB_ORIGIN, `Content-Type: application/json` e `X-CSRF-Token`.

| Método/rota                             | Contrato                                      | Autorização                        |
| --------------------------------------- | --------------------------------------------- | ---------------------------------- |
| GET /auth/login                         | Redirecionamento ao IdP                       | Público com limite de requisições  |
| GET /auth/callback                      | Callback OIDC, consumo único                  | Cookie de login + state/nonce/PKCE |
| POST /auth/logout                       | Corpo `{}`; 204                               | Sessão + CSRF                      |
| GET /v1/me                              | Identidade, MFA, CSRF e vínculos              | Sessão                             |
| GET /v1/tenants/:tenantId               | Cadastro da própria empresa                   | company:read                       |
| GET /v1/tenants/:tenantId/units         | Até 100 unidades em escopo                    | unit:read                          |
| GET /v1/tenants/:tenantId/units/:id     | Unidade em escopo                             | unit:read                          |
| POST /v1/tenants/:tenantId/units        | `{name}`                                      | unit:write + MFA                   |
| PATCH /v1/tenants/:tenantId/units/:id   | `{name, version}`                             | unit:write + MFA                   |
| GET /v1/tenants/:tenantId/members       | Até 100 vínculos em escopo                    | member:read                        |
| POST /v1/tenants/:tenantId/members      | `{userId,displayName,role,allUnits,unitIds}`  | member:write + MFA                 |
| PATCH /v1/tenants/:tenantId/members/:id | `{active,version}`                            | member:write + MFA                 |
| GET /v1/tenants/:tenantId/audit         | Até 100 eventos recentes                      | audit:read + escopo total          |
| GET /v1/platform/tenants                | Cadastro comercial, sem dados operacionais    | Operador comercial + MFA           |
| POST /v1/platform/tenants               | `{legalName,name,cnpj,adminUserId,adminName}` | Operador comercial + MFA           |
| GET /health/live                        | Processo ativo                                | Público, sem conteúdo confidencial |
| GET /health/ready                       | Banco disponível                              | Público, sem credenciais           |

IDs de empresa, unidade e vínculo são UUID. `userId` é o identificador hexadecimal de 64 caracteres de Minha conta, derivado de issuer/sub; não é CPF/e-mail. Nomes: 2–120 caracteres. Perfil: COMPANY_ADMIN, SST, SUPERVISOR, EXECUTOR ou AUDITOR. Administrador tem `allUnits=true`. Escopo restrito exige unidade válida da empresa.

Campos adicionais são rejeitados. Erros: 400 validação, 401 sessão inválida, 403 permissão/MFA/CSRF, 404 recurso inexistente ou não acessível, 409 concorrência/duplicidade, 413 corpo excessivo, 429 limite, 503 dependência indisponível. Nenhum erro retorna SQL ou segredos.

Criação de unidade:

```json
{ "name": "Unidade de demonstração" }
```

Atualização exige a versão consultada:

```json
{ "name": "Novo nome", "version": 1 }
```

Não repetir aprovação humana automaticamente após 409. Recarregar e apresentar diferenças. Paginação além do limite inicial e idempotência de emissão serão necessárias antes de ampliar a operação.
