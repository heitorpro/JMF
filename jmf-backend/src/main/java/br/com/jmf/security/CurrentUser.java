package br.com.jmf.security;

import br.com.jmf.domain.model.Permission;
import br.com.jmf.domain.model.Role;

import java.util.Set;
import java.util.UUID;

/**
 * Usuário autenticado já resolvido no banco. O {@code customerId} vem SEMPRE daqui
 * (derivado do token), nunca do payload enviado pelo navegador.
 */
public record CurrentUser(
        UUID userId,
        String authUserId,
        String name,
        String email,
        String phone,
        Role role,
        Set<Permission> permissions,
        UUID customerId) {

    public boolean isManager() {
        return role == Role.GESTOR;
    }

    public boolean has(Permission permission) {
        return permissions.contains(permission);
    }
}
