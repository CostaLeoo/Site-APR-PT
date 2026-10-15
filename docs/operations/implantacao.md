# Guia de implantação — preparação, não autorização para produção

Esta entrega não foi implantada em nuvem. Docker Compose usa modo de desenvolvimento e credenciais locais. Antes de homologação, definir infraestrutura/provedor de identidade, orçamento, região, capacidade, RPO/RTO e responsáveis SST/jurídico.

## Preparação

- Construir a imagem com `docker build -t vigia:homolog .`; Dockerfile não foi executado neste ambiente sem Docker.
- Rodar API e web como serviços separados; a imagem padrão inicia API. Para web, sobrescrever comando para `npm run start -w @apr/web`.
- Injetar configuração por secret manager. Não copiar `.env` da estação nem `.local` para imagens.
- Definir `API_INTERNAL_ORIGIN` no build do Next para o endereço interno da API. Rewrites são avaliados no build.
- Usar a mesma origem pública de web/callback com rotas `/v1` e `/auth` encaminhadas à API; configurar redirect URI exata.
- Não expor PostgreSQL ou painel administrativo do IdP publicamente sem controles apropriados.
- Usar contas separadas para aplicação, proprietário NOLOGIN e migração; revisar funções SECURITY DEFINER.
- Executar migrações como job separado com backup e plano de recuperação. Nunca dar credencial de migração ao runtime.
- Runtime não contém dados seed nem credenciais de teste. Dockerfile é base inicial; SBOM, assinatura e imagens por digest deverão integrar o processo de release.

## Homologação de identidade

Validar MFA efetivo no IdP, mapeamento ACR, recuperação, revogação, sessões simultâneas e relógios. O cliente verifica assinatura do ID token. Exigir evidência de que o ACR aceito só é emitido após os fatores configurados. Os testes locais usam IdP simulado e não homologam Keycloak.

## Operação

Gateway: TLS obrigatório, HSTS, limites de conexão/requisição, logs sem query de callback e sem cookies. Rate limit de API é por identidade autenticada; login por IP. Gateway deve proteger tráfego não autenticado e ter configuração explícita de proxies confiáveis.

Monitorar disponibilidade, latência, erros, negações, capacidade do banco e filas futuras. Centralizar logs de segurança fora do banco operacional. Rotina de manutenção deve limpar apenas sessões/tentativas/contadores expirados; nunca aplicar política genérica de limpeza a documentos SST.

Backup: definir frequência por RPO, criptografar com chaves separadas e manter cópia fora do ambiente principal. Ensaiar restauração isolada, conferir contagens, vínculos, hashes e permissões. Nenhuma restauração automatizada de produção foi comprovada nesta fase.

Rollback: compatibilidade entre versão de aplicação e migrações; priorizar migração corretiva progressiva, sem apagar registros. Incidente: preservar evidências, conter acessos, avaliar impacto com controlador/jurídico e registrar recuperação.

## Bloqueios de produção

Aplicam-se integralmente o checklist de segurança e as decisões DEC-01 a DEC-09 do roadmap. Não ativar emissão operacional por configuração comercial. Assinaturas, custódia e contingência em campo precisam de homologação própria.
