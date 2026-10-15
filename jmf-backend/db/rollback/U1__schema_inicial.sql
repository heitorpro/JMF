-- =====================================================================
-- ROLLBACK MANUAL da V1__schema_inicial.sql
-- Flyway Community não executa "undo" automaticamente. Use este script
-- SOMENTE após backup (Neon: crie um branch antes). Destrói todos os dados.
--
--   psql "$DATABASE_URL_UNPOOLED" -f db/rollback/U1__schema_inicial.sql
-- =====================================================================
begin;

drop table if exists notifications cascade;
drop table if exists audit_logs cascade;
drop table if exists request_events cascade;
drop table if exists rentals cascade;
drop table if exists rental_requests cascade;
drop sequence if exists rental_request_protocol_seq;
drop table if exists attachments cascade;
drop table if exists dumpsters cascade;
drop table if exists locations cascade;
drop table if exists customers cascade;
drop table if exists user_permissions cascade;
drop table if exists app_users cascade;
drop table if exists company_settings cascade;
drop function if exists jmf_forbid_mutation();

delete from flyway_schema_history where version = '1' or (version is null and description = 'dev seed');

commit;
