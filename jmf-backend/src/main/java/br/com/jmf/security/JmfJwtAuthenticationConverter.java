package br.com.jmf.security;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/** JWT validado → usuário do banco → authorities ROLE_CLIENTE/ROLE_GESTOR + PERM_*. */
@Component
public class JmfJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final UserProvisioningService provisioning;
    private final CurrentUserCache cache;

    public JmfJwtAuthenticationConverter(UserProvisioningService provisioning, CurrentUserCache cache) {
        this.provisioning = provisioning;
        this.cache = cache;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        String key = jwt.getSubject() + '|' + jwt.getClaimAsString("email") + '|' + jwt.getClaimAsString("name")
                + '|' + UserProvisioningService.tokenRoles(jwt);
        CurrentUser user = cache.get(key, () -> provisioning.resolve(jwt));
        List<GrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_" + user.role().name()));
        user.permissions().forEach(p -> authorities.add(new SimpleGrantedAuthority(p.authority())));
        return new JmfAuthenticationToken(jwt, authorities, user);
    }
}
