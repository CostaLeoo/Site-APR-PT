# Plano de segurança e LGPD

## Ameaças e controles

| Ameaça                      | Controle                                                    | Evidência esperada                             |
| --------------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| IDOR/acesso cruzado         | RLS + vínculo + escopo + FK composto                        | Integração com dois tenants e usuário restrito |
| Escalada de privilégio      | Permissões no servidor, MFA, payload estrito                | Executor/comercial negados                     |
| Sequestro/fixação de sessão | Cookie opaco, hash, rotação no login, prazo absoluto/ocioso | Expiração, logout, cookie antigo inválido      |
| Login CSRF/replay           | Cookie correlacionado, state, nonce, PKCE e consumo único   | Callback inválido/repetido negado              |
| CSRF em mutações            | Origin exata + token + JSON                                 | Requisição sem origem/token negada             |
| Injeção/XSS                 | Queries parametrizadas, Zod, escaping React                 | Payloads malformados e conteúdo literal        |
| Corrida de atualização      | Transação serializable + version                            | Atualização concorrente não sobrescreve        |
| Alteração da auditoria      | Trigger e privilégio append-only                            | UPDATE/DELETE negados ao runtime               |
| Falha do banco              | 503 e sem fallback permissivo                               | Sem sessão ou sucesso inventado                |
| Arquivo malicioso           | Quarentena, scanner e validação de bytes                    | Fase 2                                         |
| Falsificação documental     | Versão, provedor, assinatura e validação                    | Fases 3–4                                      |
| Perda de documentos         | Retenção, backup externo, restauração                       | Fase 4/6                                       |

Sessões OIDC não armazenam senha, access token ou refresh token. Desativar vínculo corta acesso à empresa imediatamente. Logout encerra a sessão da aplicação; backchannel logout do IdP e revogação global ainda são pendências de produção. Não confundir logout local com encerramento de todas as sessões do provedor.

Não registrar corpos, cookies, tokens ou parâmetros de callback em logs. Configurar gateway/observabilidade com as mesmas exclusões. Eventos locais de segurança ainda precisam de coletor durável, alertas e retenção aprovada.

## Papéis LGPD propostos — sujeitos a contrato e operação real

Cliente tende a controlador dos dados de SST; SaaS tende a operador sob instruções nessa operação. SaaS poderá ser controlador dos dados comerciais e de segurança próprios. Classificação não decorre apenas do nome contratado.

Definir bases legais por finalidade, minimização, transparência, canal dos titulares, subprocessadores, transferências internacionais e resposta a incidentes. Dados de saúde exigem acesso segregado e fundamento específico. Consentimento não será adotado automaticamente na relação de trabalho.

## Incidente

Detectar → conter sem destruir evidência → preservar logs → classificar impacto e titulares → envolver controlador e jurídico → comunicar conforme regra aplicável → recuperar → registrar causa e ações. Prazos legais de comunicação precisam de validação da regulação vigente; não foram inventados no sistema.

## Checklist de produção

- [ ] Homologar IdP, MFA, recuperação e conta de emergência.
- [ ] Gateway HTTPS, HSTS, CSP com nonce e proxy confiável.
- [ ] Segredos em cofre e rotação; banco/objetos/backups criptografados.
- [ ] Runtime sem acesso à credencial de migração.
- [ ] Auditoria externa e alertas de segurança.
- [ ] Teste de intrusão independente e revisão de dependências.
- [ ] Backup restaurado em ambiente isolado, RPO/RTO medidos.
- [ ] Contratos LGPD, matriz de retenção e processo de descarte aprovados.
- [ ] Piloto, acessibilidade e contingência em campo validados.
