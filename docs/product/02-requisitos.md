# Requisitos rastreáveis

Obrigatório aqui significa requisito do produto; a classificação legal está na matriz normativa.

| ID     | Requisito / aceitação                                                            | Fase |
| ------ | -------------------------------------------------------------------------------- | ---- |
| FUN-01 | Autenticação OIDC validada; MFA de privilegiados; expiração e logout             | 1    |
| FUN-02 | Empresas com razão social, fantasia e CNPJ; unidades; vínculos por empresa       | 1    |
| FUN-03 | Negação de acesso a outra empresa por ID, relação, consulta e atualização        | 1    |
| FUN-04 | Permissões por ação e unidade; operador comercial sem acesso a conteúdo          | 1    |
| FUN-05 | Modelos por atividade, versão, vigência, revisor e escopo de aprovação           | 2    |
| FUN-06 | Perguntas verticais; Sim/Não/N/A verticais; resposta esperada configurada        | 2    |
| FUN-07 | Criticidade, obrigatoriedade, justificativa, foto e bloqueio por pergunta        | 2    |
| FUN-08 | APR por etapas, perigos, consequências, metodologia, controles e risco residual  | 2    |
| FUN-09 | Até cinco fotos por pergunta, câmera/galeria, validação, quarentena e versões    | 2    |
| FUN-10 | Rascunho, autosave confirmado, histórico e conflito entre editores               | 2    |
| FUN-11 | PT ligada à versão da APR, revisão humana, autorizações e encerramento           | 3    |
| FUN-12 | PET com modelo e regras próprios; nenhuma liberação por checklist isolado        | 3    |
| FUN-13 | Assinaturas com identidade, autenticação, integridade e versão                   | 3    |
| FUN-14 | PDF com evidências, situação, versão e QR autenticado                            | 4    |
| FUN-15 | Retenção fundamentada, investigação, exportação e guarda pós-contrato            | 4    |
| FUN-16 | Dashboard e filtros por unidade, período, setor, responsável, atividade e status | 3–4  |
| FUN-17 | Planos, limites, cobrança, webhook autenticado e idempotente                     | 5    |
| FUN-18 | Administração comercial separada; suporte excepcional auditado                   | 1/5  |

## Não funcionais

- SEG-01: autorização no servidor e RLS; conta runtime sem superuser/BYPASSRLS/propriedade.
- SEG-02: cookies HttpOnly/Secure em produção; CSRF com origem e token; nenhuma senha da aplicação.
- SEG-03: TLS externo, banco/objetos/backups criptografados e segredos fora do Git.
- SEG-04: entradas estritas, limites de tamanho e requisições; erros sem SQL/segredos.
- AUD-01: data do servidor UTC; fuso IANA na apresentação; versão em alterações.
- AUD-02: trilha administrativa sem UPDATE/DELETE para runtime; preservação externa na fase documental.
- UX-01: alvo WCAG 2.2 AA; teclado, foco visível, leitura sem depender de cor e toques de pelo menos 44 px como decisão de produto.
- DISP-01: indisponibilidade ou resposta incerta não equivale a autorização.
- OPS-01: CI com build e testes; migrações imutáveis por checksum; restauração ensaiada.
- PERF-01: paginação obrigatória antes de volumes acima do limite inicial de 100 registros.
- PERF-02: metas propostas para homologação: p95 de consultas comuns abaixo de 500 ms sob carga definida; SLO/RPO/RTO ainda precisam de aprovação e medição.

Dados sintéticos somente. Formulários nunca pedirão diagnósticos médicos por padrão. ASO futuro terá domínio restrito; a operação recebe apenas condição de aptidão necessária.
