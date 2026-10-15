# Vigia — plataforma APR / PT

Fundação de um SaaS brasileiro multiempresa. **Em desenvolvimento; não homologado para autorizar atividades reais.** A entrega contém especificação, protótipo navegável e implementação da Fase 1. APR, PT/PET operacionais, fotografias, assinaturas documentais, PDFs, retenção e cobrança pertencem às próximas fases.

## Começar

Requisitos: Node.js 24 e npm. Para login com o provedor local: Docker Engine com Docker Compose. No Windows, usar `npm.cmd` se a política do PowerShell bloquear `npm.ps1`.

```sh
npm ci
npm run setup:local
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

O script `setup:local` gera senhas aleatórias, `.env`, configuração do Keycloak e `.local/demo-access.txt`. Recusa sobrescrever `.env`. Aguarde o Keycloak terminar a importação antes do login. Use os usuários fictícios de `.local/demo-access.txt` e cadastre o segundo fator no primeiro acesso.

- Aplicação: http://localhost:3000
- Protótipo sem login: http://localhost:3000/demonstracao
- API local: http://localhost:4000
- OpenAPI de desenvolvimento: http://localhost:4000/api-docs
- Identidade local: http://localhost:8080

Sem Docker, a demonstração funciona com `npm run dev -w @apr/web`. Para desenvolvimento do banco existe `npm run dev:database`, que inicia PostgreSQL local em terminal separado; não substitui o provedor OIDC. Os testes automatizados iniciam seu próprio PostgreSQL e IdP fictício, sem contas externas.

O Compose e o realm Keycloak são entregues para desenvolvimento. Sua execução real ainda deve ser validada em uma máquina com Docker; o teste OIDC automatizado não equivale à homologação de um provedor real.

## Implementado

- Next.js/React responsivo, navegação e telas originais em português.
- API NestJS com autenticação OIDC, PKCE, state, nonce e verificação de assinatura de ID token.
- Sessões opacas, expiração, logout, MFA para perfis privilegiados e CSRF.
- Empresas, unidades, usuários vinculados, perfis e escopos de unidade.
- PostgreSQL com RLS, chaves compostas e credencial runtime restrita.
- Operador comercial separado, sem vínculo implícito com empresas.
- Versão em alterações e trilha administrativa gerada no banco.
- Migrações verificadas por hash e dados exclusivamente fictícios.
- Testes de integração e navegador; configuração de CI, ainda não executada no GitHub.

O cadastro de usuário cria um vínculo com identidade existente no IdP, sem cadastrar senha na aplicação. O CNPJ recebe validação de formato; consulta cadastral externa e validação completa dos dígitos ainda não estão integradas.

## Verificação

```sh
npm run db:generate
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Os testes usam PostgreSQL real e identidades fictícias. O provedor OIDC de teste fica exclusivamente em `tests/`, sem rota de bypass na aplicação. O E2E usa as portas 3000 e 4000; encerre serviços locais nessas portas antes de rodá-lo.

Relatório e limites: [verificação da entrega](docs/operations/verificacao.md).

## Documentação

1. [Visão](docs/product/01-visao.md)
2. [Pesquisa e matriz normativa](docs/compliance/10-matriz-normativa.md)
3. [Requisitos](docs/product/02-requisitos.md)
4. [Arquitetura](docs/architecture/03-arquitetura.md)
5. [Modelo de dados](docs/architecture/04-dados.md)
6. [Autorização](docs/architecture/05-autorizacao.md)
7. [Fluxos APR/PT/PET](docs/product/06-fluxos.md)
8. [Protótipo e UX](docs/product/07-prototipo.md)
9. [Segurança e LGPD](docs/operations/08-seguranca.md)
10. [Roadmap e pendências de homologação](docs/product/09-roadmap.md)

Também: [API](docs/operations/api.md), [instalação](docs/operations/instalacao.md), [implantação](docs/operations/implantacao.md) e [referência pública de mercado](docs/compliance/referencia-mercado.md).

## GitHub e tamanho dos arquivos

**Não envie a pasta inteira pelo navegador.** `node_modules`, `.local`, `.next`, `dist` e relatórios são gerados localmente. `.env` e arquivos de acesso contêm segredos. Todos estão no `.gitignore`; não use `git add -f` nessas pastas.

Se usar Git/GitHub Desktop, publique apenas os arquivos não ignorados. Se preferir o upload manual, gere uma cópia enxuta:

```sh
python scripts/export-source.py
```

O comando cria `.local/vigia-github.zip`, sem dependências, bancos, builds ou segredos. **Extraia o ZIP e envie seu conteúdo**, incluindo os arquivos de configuração ocultos; não publique apenas o ZIP como substituto do repositório. O script inclui uma lista permitida de arquivos e recusa links simbólicos.

O `package-lock.json` deve ser enviado: ele reproduz as versões com `npm ci`. Os arquivos excluídos continuam no computador e não precisam ser apagados.

## Limites conhecidos

Pesquisa normativa preliminar e modelos sem aprovação profissional. Docker/Keycloak real, implantação, recuperação de conta, auditoria externa, backup restaurado, teste de intrusão e carga ainda exigem evidência. A checagem automatizada de acessibilidade não equivale a certificação WCAG.

As telas demonstrativas não salvam APR ou emitem PT. Não confundir MFA de login com assinatura eletrônica de documento. Hash da auditoria verifica consistência do evento, mas não impede um administrador do banco de reescrever evento e hash; preservação externa é uma etapa adicional obrigatória antes da produção.
