# Modelo de dados

Implementado em database/schema.prisma e migrações SQL:

- Tenant → Unit e Membership.
- Membership → UnitScope → Unit, com chaves estrangeiras compostas por tenantId.
- Session: hash do token, identidade, MFA, CSRF, vencimento absoluto e por inatividade.
- LoginAttempt: state, nonce, PKCE e cookie correlacionado, consumo atômico e expiração curta.
- AuditEvent: ator, recurso, ação, versão e horário; gerado por triggers.
- PlatformOperator: registro separado, não concede Membership.

O schema Prisma descreve entidades; SQL é a fonte das políticas, triggers e privilégios. Nunca usar prisma db push para substituir as migrações.

## Modelo lógico das próximas fases

Template → TemplateVersion → QuestionVersion → NormativeReference. A aprovação registra revisor, competência, escopo, data e fundamento; publicação exige revisão humana.

APR → APRVersion → ActivityStep → HazardAssessment → ControlMeasure. Metodologia versionada; risco residual não é uma escala universal fixa.

PT → PTVersion → APRVersion; TeamAssignment e Approval vinculados à versão. OperationalDesignation inclui unidade, atividade, função, evidência, emissor e validade. Qualification não substitui designação formal.

Answer referencia QuestionVersion e DocumentVersion. Photo referencia Answer, originalObjectVersion, derivedObjectVersion, receivedAt, sha256, mime detectado, scannerStatus. Limite de cinco verificado transacionalmente.

Signature referencia documento, versão, hash canônico, autenticação, modalidade e evidências do provedor. PDF e manifest de anexos integram o pacote de evidências.

RetentionPolicy tem tipo documental, aplicabilidade, fonte, prazo mínimo, evento inicial, condições e revisão. RetentionAssignment preserva a política efetivamente aplicada. LegalHold impede descarte independentemente do contrato.

BillingSubscription, Invoice e WebhookInbox ficam fora do domínio de autorização ocupacional. eventId único e sequência temporal impedem repetição ou reversão indevida de estados.

Cada relação entre entidades de cliente deve incluir tenantId no FK e ter teste de tentativa de vínculo cruzado. Não usar somente UUID como prova de autorização.
