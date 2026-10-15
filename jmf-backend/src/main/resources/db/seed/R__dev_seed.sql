-- =====================================================================
-- SEED DE DESENVOLVIMENTO — NUNCA HABILITAR EM PRODUÇÃO.
-- Carregado apenas pelo perfil "dev" (spring.flyway.locations inclui db/seed).
-- Idempotente: usa ON CONFLICT DO NOTHING.
--
-- Usuários de teste (gere tokens em POST /api/dev/token, perfil dev):
--   sub = dev-gestor  -> gestor com todas as permissões
--   sub = dev-joao    -> cliente João da Silva (com caçamba #024 ativa)
--   sub = dev-marcos  -> cliente Marcos Costa (com caçamba #019 ativa)
-- =====================================================================

insert into app_users (id, auth_user_id, name, email, phone, role) values
  ('00000000-0000-0000-0000-000000000001', 'dev-gestor', 'Gestor JMF',      'gestor@jmf.dev',          '+5598981000000', 'gestor'),
  ('00000000-0000-0000-0000-000000000011', 'dev-joao',   'João da Silva',   'joao.silva@email.com',    '+5598988772211', 'cliente'),
  ('00000000-0000-0000-0000-000000000012', 'dev-marcos', 'Marcos Costa',    'marcos.costa@email.com',  '+5598991441820', 'cliente'),
  ('00000000-0000-0000-0000-000000000013', 'dev-camila', 'Camila Nascimento','camila.n@email.com',     '+5598987054032', 'cliente')
on conflict do nothing;

insert into user_permissions (user_id, permission)
select '00000000-0000-0000-0000-000000000001', p
from unnest(array['REQUESTS_MANAGE','FLEET_MANAGE','CUSTOMERS_VIEW','RENTALS_VIEW','MAP_VIEW','SETTINGS_MANAGE']) as p
on conflict do nothing;

insert into customers (id, user_id, name, phone, email, status) values
  ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000011', 'João da Silva',     '+5598988772211', 'joao.silva@email.com',   'ativo'),
  ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000012', 'Marcos Costa',      '+5598991441820', 'marcos.costa@email.com', 'ativo'),
  ('10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000013', 'Camila Nascimento', '+5598987054032', 'camila.n@email.com',     'ativo')
on conflict do nothing;

insert into locations (id, owner_customer_id, postal_code, street, number, neighborhood, city, state, latitude, longitude, label, source) values
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000011', '65075000', 'Avenida dos Holandeses', '120', 'Calhau',           'São Luís', 'MA', -2.488900, -44.268100, 'Calhau, São Luís — MA', 'endereco'),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000012', '65076000', 'Rua das Gaivotas',       '45',  'Ponta d''Areia',   'São Luís', 'MA', -2.497600, -44.302400, 'Ponta d''Areia, São Luís — MA', 'endereco'),
  ('20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000013', '65030000', 'Rua do Sol',             '310', 'Centro',           'São Luís', 'MA', -2.529700, -44.302800, 'Centro, São Luís — MA', 'gps')
on conflict do nothing;

-- Frota: 30 caçambas (#001..#030) livres por padrão
insert into dumpsters (number, status)
select n, 'livre' from generate_series(1, 30) as n
on conflict (number) do nothing;

update dumpsters set status = 'manutencao', notes = 'Troca de rodízios'
 where number = 7 and status = 'livre' and customer_id is null;
update dumpsters set status = 'indisponivel', notes = 'Aguardando vistoria'
 where number = 12 and status = 'livre' and customer_id is null;

-- João com a #024 e Marcos com a #019, em uso
update dumpsters set status = 'ocupada', customer_id = '10000000-0000-0000-0000-000000000011',
       location_id = '20000000-0000-0000-0000-000000000011', rental_started_at = current_date - 3
 where number = 24 and status = 'livre';
update dumpsters set status = 'ocupada', customer_id = '10000000-0000-0000-0000-000000000012',
       location_id = '20000000-0000-0000-0000-000000000012', rental_started_at = current_date - 5
 where number = 19 and status = 'livre';

insert into rental_requests (id, protocol, type, status, customer_id, dumpster_id, location_id, desired_date, price_cents, details, created_by, created_at)
select '30000000-0000-0000-0000-000000000011', 'JMF-DEV-000001', 'aluguel', 'em_uso',
       '10000000-0000-0000-0000-000000000011', d.id, '20000000-0000-0000-0000-000000000011',
       current_date - 3, 30000, 'Reforma de banheiro', '00000000-0000-0000-0000-000000000011', now() - interval '4 days'
  from dumpsters d where d.number = 24
on conflict do nothing;

insert into rental_requests (id, protocol, type, status, customer_id, dumpster_id, location_id, desired_date, price_cents, details, created_by, created_at)
select '30000000-0000-0000-0000-000000000012', 'JMF-DEV-000002', 'aluguel', 'em_uso',
       '10000000-0000-0000-0000-000000000012', d.id, '20000000-0000-0000-0000-000000000012',
       current_date - 5, 30000, 'Demolição de muro', '00000000-0000-0000-0000-000000000012', now() - interval '6 days'
  from dumpsters d where d.number = 19
on conflict do nothing;

-- Camila com uma solicitação pendente
insert into rental_requests (id, protocol, type, status, customer_id, location_id, desired_date, price_cents, details, created_by)
values ('30000000-0000-0000-0000-000000000013', 'JMF-DEV-000003', 'aluguel', 'pendente',
        '10000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000013',
        current_date + 2, 30000, 'Entulho de obra', '00000000-0000-0000-0000-000000000013')
on conflict do nothing;

insert into rentals (id, customer_id, dumpster_id, location_id, request_id, started_at, weekly_price_cents, status, operation)
select '40000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000011', d.id,
       '20000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000011',
       current_date - 3, 30000, 'ativo', 'locacao'
  from dumpsters d where d.number = 24
on conflict do nothing;

insert into rentals (id, customer_id, dumpster_id, location_id, request_id, started_at, weekly_price_cents, status, operation)
select '40000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000012', d.id,
       '20000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000012',
       current_date - 5, 30000, 'ativo', 'locacao'
  from dumpsters d where d.number = 19
on conflict do nothing;
