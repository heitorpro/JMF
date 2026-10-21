-- Planos de aluguel: 7, 15 ou 30 dias, cada um com seu preço (configurável pelo gestor).
-- Valores iniciais de 15 e 30 dias são provisórios: ajuste em Configurações.

alter table company_settings
  add column price_15_cents bigint not null default 60000 check (price_15_cents >= 0),
  add column price_30_cents bigint not null default 120000 check (price_30_cents >= 0);

-- Período escolhido na solicitação (a troca herda o período da locação trocada).
alter table rental_requests
  add column period_days integer not null default 7 check (period_days in (7, 15, 30));

-- Período e valor congelados em cada locação. weekly_price_cents passa a significar
-- "valor do período contratado" (mantido o nome para não quebrar dados existentes).
alter table rentals
  add column period_days integer not null default 7 check (period_days in (7, 15, 30));

-- Sincroniza telefone do usuário para o cadastro de cliente quando estiver faltando.
update customers c set phone = u.phone
  from app_users u
 where u.id = c.user_id and c.phone is null and u.phone is not null;
