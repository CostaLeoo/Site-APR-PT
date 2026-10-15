# Modelo de autorização

Negar por padrão. Avaliar sessão válida → vínculo ativo → empresa → permissão → unidade → regras do recurso. MFA obrigatório para administrador, SST, supervisor e operador comercial. Auditor/executante também podem usar MFA.

| Papel                    | Fundação                                                                          | Liberação operacional            |
| ------------------------ | --------------------------------------------------------------------------------- | -------------------------------- |
| Comercial                | Cadastro comercial e criação de empresa com administrador explicitamente indicado | Nunca por esse papel             |
| Administrador da empresa | Unidades, vínculos, consulta e auditoria da empresa                               | Não concedida pelo perfil        |
| SST                      | Consulta em escopo, preparação para revisão futura                                | Exigirá competência e designação |
| Supervisor               | Consulta em escopo                                                                | Exigirá competência e designação |
| Executante               | Consulta às unidades autorizadas                                                  | Não concedida                    |
| Auditor                  | Consulta em escopo; auditoria somente com escopo da empresa                       | Não concedida                    |

Vínculos são criados usando identificador de identidade exibido em Minha conta, sem pesquisa global de usuários por e-mail. Não é cadastro de credencial: senha, recuperação e MFA pertencem ao IdP. Usuário sem vínculo entra na conta, mas não obtém dados de cliente.

Admin não pode desativar a si mesmo. Alteração de vínculo tem version; operações concorrentes retornam conflito. Desativação impede a próxima consulta ao cliente sem depender de expiração de JWT.

Não há bypass de suporte. A futura concessão deverá registrar solicitante do cliente, aprovação, operador, finalidade, recurso, expiração e eventos de uso.

Antes da Fase 3: implementar registros de treinamento, competência, designação e aptidão mínima, revogação, validade e teste no instante da aprovação. Sujeito sem requisito não obtém liberação mesmo sendo administrador.

Limitação explícita: RLS é defesa contra consultas acidentais de outro tenant, não contra administrador PostgreSQL. Auditoria externa e revisão de privilégios complementam a solução.
