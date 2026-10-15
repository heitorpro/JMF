-- Frota real da JMF: 30 caçambas (#001 a #030), todas livres no início da operação.
-- Idempotente: se alguma já existir, não é duplicada.
insert into dumpsters (number, status)
select n, 'livre' from generate_series(1, 30) as n
on conflict (number) do nothing;