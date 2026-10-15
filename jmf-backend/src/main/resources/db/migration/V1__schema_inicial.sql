-- =====================================================================
-- JMF — Schema inicial
-- PostgreSQL 15+ (Neon). gen_random_uuid() é nativo desde o PG 13.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Função utilitária: bloqueia UPDATE/DELETE em tabelas de auditoria
-- ---------------------------------------------------------------------
create or replace function jmf_forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'Registro de auditoria é imutável (tabela %).', tg_table_name
    using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------
-- Usuários (complemento do Neon Auth)
-- ---------------------------------------------------------------------
create table app_users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  varchar(128) not null unique,           -- "sub" do JWT do Neon Auth
  name          varchar(120) not null,
  email         varchar(254) not null,
  phone         varchar(20),                            -- E.164: +55DDDNNNNNNNN
  role          varchar(16)  not null default 'cliente'
                check (role in ('cliente', 'gestor')),
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);
create index ix_app_users_role on app_users (role);

create table user_permissions (
  user_id     uuid        not null references app_users (id) on delete cascade,
  permission  varchar(40) not null
              check (permission in ('REQUESTS_MANAGE', 'FLEET_MANAGE', 'CUSTOMERS_VIEW',
                                    'RENTALS_VIEW', 'MAP_VIEW', 'SETTINGS_MANAGE')),
  primary key (user_id, permission)
);

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table customers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references app_users (id),
  name        varchar(120) not null,
  cpf         varchar(11) unique,                      -- somente dígitos; único quando informado
  phone       varchar(20),
  email       varchar(254) not null,
  status      varchar(10) not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index ix_customers_name on customers (lower(name));

-- ---------------------------------------------------------------------
-- Endereços / localização
-- ---------------------------------------------------------------------
create table locations (
  id                 uuid primary key default gen_random_uuid(),
  owner_customer_id  uuid references customers (id),  -- escopo do cliente
  postal_code        varchar(8)   not null check (postal_code ~ '^[0-9]{8}$'),
  street             varchar(160) not null,
  number             varchar(20)  not null,
  neighborhood       varchar(120) not null,
  complement         varchar(120),
  city               varchar(120) not null,
  state              char(2)      not null check (state ~ '^[A-Z]{2}$'),
  latitude           numeric(9, 6) not null check (latitude between -90 and 90),
  longitude          numeric(9, 6) not null check (longitude between -180 and 180),
  label              varchar(300) not null,
  source             varchar(10)  not null default 'endereco' check (source in ('endereco', 'gps')),
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now()
);
create index ix_locations_owner on locations (owner_customer_id);

-- ---------------------------------------------------------------------
-- Caçambas
-- ---------------------------------------------------------------------
create table dumpsters (
  id                 uuid primary key default gen_random_uuid(),
  number             integer not null unique check (number > 0),
  status             varchar(12) not null default 'livre'
                     check (status in ('livre', 'ocupada', 'manutencao', 'indisponivel')),
  customer_id        uuid references customers (id),
  location_id        uuid references locations (id),
  rental_started_at  date,
  notes              varchar(500),
  version            bigint not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- caçamba ocupada precisa de cliente; caçamba não ocupada não pode ter cliente
  constraint ck_dumpster_occupancy check (
    (status = 'ocupada' and customer_id is not null)
    or (status <> 'ocupada' and customer_id is null)
  )
);
create index ix_dumpsters_status on dumpsters (status);
create index ix_dumpsters_customer on dumpsters (customer_id);

-- ---------------------------------------------------------------------
-- Anexos (armazenamento privado)
-- ---------------------------------------------------------------------
create table attachments (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references app_users (id),
  original_name  varchar(160) not null,
  storage_key    varchar(300) not null unique,
  content_type   varchar(100) not null,
  size_bytes     bigint not null check (size_bytes > 0),
  sha256         char(64) not null,
  created_at     timestamptz not null default now()
);
create index ix_attachments_owner on attachments (owner_user_id);

-- ---------------------------------------------------------------------
-- Solicitações
-- ---------------------------------------------------------------------
create sequence rental_request_protocol_seq start 1;

create table rental_requests (
  id                       uuid primary key default gen_random_uuid(),
  protocol                 varchar(20) not null unique,
  type                     varchar(10) not null check (type in ('aluguel', 'troca', 'retirada')),
  status                   varchar(20) not null check (status in (
                             'pendente', 'aprovada', 'em_entrega', 'entregue', 'em_uso',
                             'troca_solicitada', 'em_troca', 'retirada_solicitada', 'em_retirada',
                             'finalizada', 'cancelada', 'rejeitada')),
  customer_id              uuid not null references customers (id),
  dumpster_id              uuid references dumpsters (id),
  replacement_dumpster_id  uuid references dumpsters (id),
  location_id              uuid not null references locations (id),
  desired_date             date not null,
  price_cents              bigint not null check (price_cents >= 0),
  reason                   varchar(500),
  details                  varchar(2000),
  notes                    varchar(2000),
  attachment_id            uuid references attachments (id),
  created_by               uuid not null references app_users (id),
  version                  bigint not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index ix_requests_customer_created on rental_requests (customer_id, created_at desc);
create index ix_requests_status on rental_requests (status);
create index ix_requests_type_status on rental_requests (type, status);
create index ix_requests_created on rental_requests (created_at desc);

-- Regra 3: uma caçamba só pode estar reservada por UMA solicitação de aluguel em andamento.
create unique index ux_requests_dumpster_reserved
  on rental_requests (dumpster_id)
  where type = 'aluguel' and dumpster_id is not null
    and status in ('pendente', 'aprovada', 'em_entrega');

-- Uma caçamba só pode ter uma troca OU retirada em aberto por vez.
create unique index ux_requests_open_swap_removal
  on rental_requests (dumpster_id)
  where type in ('troca', 'retirada')
    and status in ('troca_solicitada', 'em_troca', 'retirada_solicitada', 'em_retirada');

-- ---------------------------------------------------------------------
-- Locações
-- ---------------------------------------------------------------------
create table rentals (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references customers (id),
  dumpster_id         uuid not null references dumpsters (id),
  location_id         uuid not null references locations (id),
  request_id          uuid references rental_requests (id),
  started_at          date not null,
  ended_at            date,
  weekly_price_cents  bigint not null check (weekly_price_cents >= 0),
  status              varchar(10) not null default 'ativo' check (status in ('ativo', 'encerrado')),
  operation           varchar(10) not null check (operation in ('locacao', 'troca')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint ck_rental_end check (
    (status = 'ativo' and ended_at is null) or (status = 'encerrado' and ended_at is not null)
  )
);
create index ix_rentals_customer on rentals (customer_id, started_at desc);
create index ix_rentals_status on rentals (status);
-- Uma caçamba só pode ter uma locação ativa.
create unique index ux_rentals_active_dumpster on rentals (dumpster_id) where status = 'ativo';

-- ---------------------------------------------------------------------
-- Eventos de solicitação (auditoria imutável)
-- ---------------------------------------------------------------------
create table request_events (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references rental_requests (id),
  from_status    varchar(20),
  to_status      varchar(20) not null,
  actor_user_id  uuid not null references app_users (id),
  notes          varchar(1000),
  created_at     timestamptz not null default now()
);
create index ix_request_events_request on request_events (request_id, created_at);
create index ix_request_events_created on request_events (created_at desc);
create trigger trg_request_events_immutable
  before update or delete on request_events
  for each row execute function jmf_forbid_mutation();

-- ---------------------------------------------------------------------
-- Auditoria administrativa genérica (caçambas, configurações, alocações)
-- ---------------------------------------------------------------------
create table audit_logs (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid not null references app_users (id),
  entity_type    varchar(40) not null,
  entity_id      varchar(64) not null,
  action         varchar(60) not null,
  before_data    jsonb,
  after_data     jsonb,
  created_at     timestamptz not null default now()
);
create index ix_audit_entity on audit_logs (entity_type, entity_id, created_at desc);
create trigger trg_audit_logs_immutable
  before update or delete on audit_logs
  for each row execute function jmf_forbid_mutation();

-- ---------------------------------------------------------------------
-- Notificações
-- ---------------------------------------------------------------------
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references app_users (id),
  audience     varchar(10) not null check (audience in ('cliente', 'gestor', 'ambos')),
  title        varchar(120) not null,
  description  varchar(500) not null,
  request_id   uuid references rental_requests (id),
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index ix_notifications_user on notifications (user_id, created_at desc);
create index ix_notifications_unread on notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------
-- Configurações da empresa (linha única)
-- ---------------------------------------------------------------------
create table company_settings (
  id                  smallint primary key default 1 check (id = 1),
  weekly_price_cents  bigint not null check (weekly_price_cents >= 0),
  period_days         integer not null check (period_days between 1 and 90),
  whatsapp            varchar(20),
  email               varchar(254),
  phone               varchar(20),
  address             varchar(300),
  updated_by          uuid references app_users (id),
  updated_at          timestamptz not null default now()
);

-- Valores iniciais equivalentes aos do frontend (R$ 300,00 / 7 dias).
insert into company_settings (id, weekly_price_cents, period_days, email, address)
values (1, 30000, 7, 'atendimento@jmfentulhos.com.br', 'São Luís, Maranhão');
