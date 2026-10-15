# Roadmap e critérios de avanço

1. Especificação: dez documentos, fontes, matriz preliminar e protótipo. Revisões profissionais permanecem registradas, sem transformar rascunhos em modelos aprovados.
2. Fundação: build reproduzível, OIDC, MFA exigido, empresas, unidades, vínculos, RLS, migrações, dados fictícios e testes. Testar PostgreSQL e fluxo de navegador; Docker/IdP real precisam de execução própria.
3. APR: começar somente com escopo normativo dos modelos decidido. Implementar versões, metadados, metodologia, controles, fotos, autosave e histórico. Testes de resposta incompatível, arquivos, perda de conexão e concorrência.
4. PT: implementar qualificações/designações mínimas antes de qualquer liberação; aprovação humana, PET específica, assinatura juridicamente definida e condições atuais. Testes completos de transição e impedimento.
5. Documentos: PDF verificável, QR autenticado, evidências, custódia, retenção por classe, investigação e exportação. Ensaiar restauração e integridade.
6. Comercial: selecionar provedor brasileiro; autenticar webhooks, idempotência, tolerância, cancelamento e reativação. Segurança operacional independe de cobrança.
7. Homologação: SST, jurídico, teste de invasão, carga, acessibilidade, piloto e critérios de liberação para produção.

Cada fase entrega código, testes, execução e documentação. Nenhuma fase posterior está automaticamente concluída pela presença de telas de demonstração.

## Pendências e decisões

| ID     | Decisão/evidência necessária                                                            | Bloqueia                      |
| ------ | --------------------------------------------------------------------------------------- | ----------------------------- |
| DEC-01 | Provedor de identidade e infraestrutura comercial                                       | Implantação real              |
| DEC-02 | Responsáveis SST e jurídico pela aprovação dos modelos                                  | Modelos operacionais          |
| DEC-03 | Modalidade/provedor de assinatura conforme NR e contexto                                | Emissão digital               |
| DEC-04 | Metodologia de risco e critérios de aceitabilidade por atividade                        | APR operacional               |
| DEC-05 | Acesso permanente em campo/contingência, especialmente PET                              | Piloto de risco               |
| DEC-06 | Matriz contratual de custódia, exportação e acesso pós-cancelamento                     | Comercialização               |
| DEC-07 | SLO, RPO, RTO, orçamento e região dos dados                                             | Produção                      |
| DEC-08 | Revisar divergência de data da Portaria 1.259 na página/PDF NR-35 e prazos do Anexo III | Modelo de escadas             |
| DEC-09 | Transição NR-10 em 01/06/2027                                                           | Modelo futuro de eletricidade |

DEC-00 resolvida pelo cliente: empresas de setores variados, organização por atividade e contexto. Não requer nova confirmação para continuar a fundação.
