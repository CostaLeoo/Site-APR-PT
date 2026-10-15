# Fluxos de APR e PT/PET — especificação

## APR

Rascunho → Em revisão → Correção solicitada → Em revisão → Aprovada. Retirada de uso preserva versão. Revisão aprovada gera snapshot imutável; mudanças geram versão nova e análise de impacto nas PTs relacionadas.

Entrada: atividade, contexto, unidade, local, equipe, equipamentos, terceiros. Análise por etapas com perigos e consequências; controles com responsáveis e verificação; risco residual conforme metodologia revisada.

## PT

| Origem                          | Destino              | Condição prevista                                                              |
| ------------------------------- | -------------------- | ------------------------------------------------------------------------------ |
| Rascunho                        | Em análise           | Conteúdo mínimo e modelo aprovado no escopo                                    |
| Em análise                      | Aguardando correção  | Revisor competente registra pendências                                         |
| Aguardando correção             | Em análise           | Nova versão com resposta às pendências                                         |
| Em análise                      | Aguardando aprovação | Revisão concluída; bloqueios resolvidos                                        |
| Aguardando aprovação            | Liberada             | Responsáveis designados, requisitos atuais, assinatura válida e versão íntegra |
| Liberada                        | Em execução          | Confirmação no local e validade atual                                          |
| Liberada/Em execução            | Suspensa             | Condição insegura, mudança ou decisão responsável                              |
| Em execução                     | Encerrada            | Registro de conclusão e condições finais                                       |
| Suspensa                        | Em análise           | Nova avaliação; nunca retorno automático à execução                            |
| Estados não finais              | Cancelada            | Responsável autorizado e motivo                                                |
| Em análise/Aguardando aprovação | Rejeitada            | Decisão fundamentada                                                           |
| Liberada/Em execução/Suspensa   | Expirada             | Limite temporal atingido; registrar situação da atividade                      |

Finalização administrativa de uma atividade expirada será evento próprio, preservando expiração no histórico. Encerrada, cancelada e rejeitada não são reabertas silenciosamente.

PET segue subfluxo próprio: campos, papéis, avaliações atmosféricas, entradas/saídas, acompanhamento e critérios de encerramento/prorrogação identificados na matriz. Não aplicar automaticamente suspensão genérica onde a regra exigir encerramento.

## Regras transversais

A máquina de estados e os checklists operacionais ainda não estão implementados na Fase 1. A autorização humana será necessária mesmo com todas as respostas compatíveis. N/A não apaga obrigação legal. Mudança de equipe, local, risco, validade ou controle gera análise de impacto e invalida aprovações quando aplicável.

Offline futuro: identificadores de operação e conflitos explícitos, cache protegido e política de expiração. A indisponibilidade de acesso exigido no local é impedimento operacional a resolver no piloto; emissão online não garante acesso permanente durante a atividade.
