package br.com.jmf.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.Collection;

public class JmfAuthenticationToken extends JwtAuthenticationToken {

    private final transient CurrentUser currentUser;

    public JmfAuthenticationToken(Jwt jwt, Collection<? extends GrantedAuthority> authorities, CurrentUser user) {
        super(jwt, authorities, user.userId().toString());
        this.currentUser = user;
    }

    public CurrentUser getCurrentUser() {
        return currentUser;
    }
}
