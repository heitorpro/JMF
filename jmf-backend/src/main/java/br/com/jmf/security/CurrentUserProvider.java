package br.com.jmf.security;

import br.com.jmf.common.ApiException;
import br.com.jmf.common.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class CurrentUserProvider {

    public CurrentUser get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JmfAuthenticationToken token && token.isAuthenticated()) {
            return token.getCurrentUser();
        }
        throw new ApiException(ErrorCode.UNAUTHENTICATED);
    }
}
