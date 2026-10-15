# Registro de decisões técnicas

## ADR-001 — Backend em Java/Spring Boot, separado do Next.js
**Contexto:** a especificação sugeria Route Handlers do Next.js com Drizzle; o pedido foi um backend em Java.
**Decisão:** serviço Spring Boot 3.5 / Java 21 que implementa o mesmo contrato (rotas `/api/*`, envelope `data/meta`, códigos HTTP). O frontend chama a API com o JWT do Neon Auth.
**Consequências:** deploy separado (container); CORS restrito às origens do frontend; o frontend troca `mockJmfService` por `httpJmfService`.

## ADR-002 — Validação do JWT do Neon Auth com Ed25519 nativo
**Contexto:** o Neon Auth assina tokens com EdDSA (Ed25519) e publica as chaves como OKP em `{NEON_AUTH_BASE_URL}/.well-known/jwks.json`; o `NimbusJwtDecoder` padrão do Spring não verifica EdDSA.
**Decisão:** `NeonJwtDecoder` próprio: JWKS com cache (TTL 10 min e refresh na rotação de `kid`), verificação Ed25519 pela JCA do Java 21 (sem dependências extras), validação de `exp`/`nbf` com tolerância, `iss` = origem da URL base e `aud` opcional. RS256/ES256 aceitos caso o provedor mude; `none` e HMAC recusados.
**Consequências:** sem cookies na API (CSRF não se aplica). O modo `hmac` existe só para dev/test e é bloqueado no perfil `prod`.

## ADR-003 — Usuário provisionado no primeiro acesso; customerId nunca vem do navegador
**Decisão:** `app_users` complementa o Neon Auth (chave `auth_user_id` = `sub`). Na primeira requisição o usuário e, se cliente, seu `customers` são criados (`INSERT ... ON CONFLICT DO NOTHING`, seguro contra concorrência). O `customerId` usado em toda consulta vem do token resolvido. Recursos de outro cliente retornam `404`.
**Consequências:** o telefone informado no cadastro precisa ser persistido via `PATCH /api/me` logo após o `signUp` (o Neon Auth não aceita claims customizadas).

## ADR-004 — Papéis: `admin` do Neon Auth + permissões finas no banco
**Decisão:** claim `role` contendo `admin` ⇒ gestor com todas as permissões (mesmo critério do frontend atual). Gestores adicionais: `app_users.role = 'gestor'` + `user_permissions`. Autorização em duas camadas: `ROLE_*` por prefixo de rota e `@PreAuthorize(PERM_*)` por ação.

## ADR-005 — Concorrência na reserva de caçambas
**Decisão:** três barreiras: (1) `SELECT ... FOR UPDATE` na caçamba e na solicitação; (2) alocação automática com `FOR UPDATE SKIP LOCKED`, de modo que alocações simultâneas peguem caçambas diferentes; (3) índices únicos parciais no banco (`ux_requests_dumpster_reserved`, `ux_requests_open_swap_removal`, `ux_rentals_active_dumpster`) que convertem qualquer corrida remanescente em `409`.
**Consequências:** a "reserva" não é um status da caçamba (os status permanecem os da especificação); é derivada das solicitações de aluguel em `pendente/aprovada/em_entrega` com caçamba alocada.

## ADR-006 — Auditoria imutável
**Decisão:** `request_events` (toda mudança de status, inclusive automáticas) e `audit_logs` (caçambas, configurações, alocações, com antes/depois em JSONB). Triggers no banco impedem `UPDATE`/`DELETE`.

## ADR-007 — Dinheiro em centavos, calculado no servidor
**Decisão:** `price_cents`/`weekly_price_cents` (`bigint`). O preço da solicitação vem de `company_settings` no momento da criação e fica congelado na solicitação e na locação. O Jackson rejeita campos desconhecidos, então `price`/`customerId` enviados pelo navegador geram `400`.

## ADR-008 — Localização da caçamba e mapa
**Decisão:** além dos campos da especificação, `dumpsters.location_id` registra onde a caçamba está (necessário para o mapa) e `locations.owner_customer_id` escopa endereços por cliente. O link do Google Maps (`mapsUrl`) é sempre montado no servidor a partir das coordenadas persistidas.

## ADR-009 — Rate limit em memória
**Decisão:** janela fixa de 1 minuto por usuário (ou IP) e grupo de rota: criação de solicitações 10/min, geocodificação 30/min, upload 10/min, demais 300/min. Cadastro e login são do Neon Auth, que aplica seus próprios limites.
**Consequências:** com múltiplas réplicas, substituir por armazenamento compartilhado (Redis/Upstash) mantendo o filtro.

## ADR-010 — Notificações por usuário
**Decisão:** notificações de público "gestor" são copiadas para cada gestor no momento da criação, mantendo `read_at` individual simples. Adequado ao tamanho da equipe; revisar se o número de gestores crescer muito.
