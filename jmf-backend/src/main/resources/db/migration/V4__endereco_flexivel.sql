-- V4: endereço mais simples para o cliente.
-- O CEP passa a ser opcional (obrigatórios: rua, número e bairro). Quando informado,
-- a regra de formato (8 dígitos) continua valendo: CHECK com NULL é aceito.
alter table locations alter column postal_code drop not null;
