package br.com.jmf.security;

import br.com.jmf.common.TextSanitizer;
import br.com.jmf.config.JmfProperties;
import br.com.jmf.domain.model.AppUser;
import br.com.jmf.domain.model.Customer;
import br.com.jmf.domain.model.Permission;
import br.com.jmf.domain.model.Role;
import br.com.jmf.domain.repository.AppUserRepository;
import br.com.jmf.domain.repository.CustomerRepository;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Resolve o usuário do token no banco, criando app_user/customer no primeiro acesso.
 *
 * <p>Papel: a claim "role" do Neon Auth contendo um dos {@code jmf.auth.admin-roles} (padrão "admin",
 * o mesmo critério de {@code hasJmfManagementAccess} no frontend) promove o usuário a gestor com todas
 * as permissões. Demais gestores são definidos no banco (app_users.role + user_permissions).</p>
 */
@Service
public class UserProvisioningService {

    private final AppUserRepository users;
    private final CustomerRepository customers;
    private final Set<String> adminRoles;

    public UserProvisioningService(AppUserRepository users, CustomerRepository customers, JmfProperties props) {
        this.users = users;
        this.customers = customers;
        List<String> configured = props.auth().adminRoles() == null ? List.of("admin") : props.auth().adminRoles();
        this.adminRoles = configured.stream().map(r -> r.toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
    }

    @Transactional
    public CurrentUser resolve(Jwt jwt) {
        String sub = jwt.getSubject();
        if (sub == null || sub.isBlank() || sub.length() > 128) {
            throw new BadJwtException("Token sem identificação de usuário");
        }
        String email = TextSanitizer.line(jwt.getClaimAsString("email"), 254);
        if (email == null) {
            email = sub + "@usuario.invalid";
        }
        String name = TextSanitizer.line(jwt.getClaimAsString("name"), 120);
        if (name == null) {
            name = email.contains("@") ? email.substring(0, email.indexOf('@')) : "Usuário";
        }
        boolean admin = tokenRoles(jwt).stream().anyMatch(adminRoles::contains);

        AppUser user = users.findByAuthUserId(sub).orElse(null);
        if (user == null) {
            users.insertIfAbsent(sub, name, email, admin ? Role.GESTOR.code() : Role.CLIENTE.code());
            user = users.findByAuthUserId(sub).orElseThrow();
        }
        if (!email.equalsIgnoreCase(user.getEmail())) {
            user.setEmail(email);
        }
        if (admin && user.getRole() != Role.GESTOR) {
            user.setRole(Role.GESTOR);
        }

        Set<Permission> permissions;
        if (admin) {
            permissions = EnumSet.allOf(Permission.class);
        } else if (user.getRole() == Role.GESTOR) {
            permissions = user.getPermissions();
        } else {
            permissions = EnumSet.noneOf(Permission.class);
        }

        UUID customerId = null;
        if (user.getRole() == Role.CLIENTE) {
            Customer customer = customers.findByUserId(user.getId()).orElse(null);
            if (customer == null) {
                customers.insertIfAbsent(user.getId(), user.getName(), user.getEmail());
                customer = customers.findByUserId(user.getId()).orElseThrow();
                if (user.getPhone() != null) {
                    customer.setPhone(user.getPhone());
                }
            }
            customerId = customer.getId();
        }

        return new CurrentUser(user.getId(), sub, user.getName(), user.getEmail(), user.getPhone(),
                user.getRole(), Set.copyOf(permissions), customerId);
    }

    /** A claim "role" pode ser string ("admin", "user,admin") ou lista. */
    static Set<String> tokenRoles(Jwt jwt) {
        Object claim = jwt.getClaims().get("role");
        if (claim == null) {
            claim = jwt.getClaims().get("roles");
        }
        if (claim instanceof Collection<?> list) {
            return list.stream().map(String::valueOf).map(s -> s.trim().toLowerCase(Locale.ROOT))
                    .collect(Collectors.toSet());
        }
        if (claim instanceof String s) {
            return Arrays.stream(s.split(",")).map(r -> r.trim().toLowerCase(Locale.ROOT))
                    .filter(r -> !r.isEmpty()).collect(Collectors.toSet());
        }
        return Set.of();
    }
}
