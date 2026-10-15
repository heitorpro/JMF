package br.com.jmf.domain.model;

/**
 * Permissões administrativas finas do gestor. Usuários com papel "admin" no Neon Auth
 * recebem todas; demais gestores recebem as concedidas na tabela user_permissions.
 */
public enum Permission {
    /** Aprovar, rejeitar, avançar, alocar e concluir trocas. */
    REQUESTS_MANAGE,
    /** Cadastrar caçambas e alterar status/observações. */
    FLEET_MANAGE,
    /** Consultar clientes. */
    CUSTOMERS_VIEW,
    /** Consultar locações. */
    RENTALS_VIEW,
    /** Consultar mapa operacional. */
    MAP_VIEW,
    /** Alterar configurações da empresa. */
    SETTINGS_MANAGE;

    public String authority() {
        return "PERM_" + name();
    }
}
