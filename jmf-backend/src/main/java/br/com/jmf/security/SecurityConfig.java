package br.com.jmf.security;

import br.com.jmf.config.JmfProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import com.nimbusds.jwt.JWTParser;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;

import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.time.Clock;
import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain apiSecurity(HttpSecurity http, JmfJwtAuthenticationConverter converter,
                                    JsonSecurityHandlers handlers, JmfProperties props, Clock clock) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable) // API stateless com Bearer token (sem cookies)
                .cors(Customizer.withDefaults())
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(h -> h
                        .contentSecurityPolicy(csp -> csp.policyDirectives(props.http().contentSecurityPolicy()))
                        .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                        .frameOptions(f -> f.deny())
                        .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31_536_000))
                        .addHeaderWriter(new StaticHeadersWriter("Permissions-Policy",
                                "camera=(), microphone=(), geolocation=()")))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers("/api/dev/**").permitAll() // controller existe apenas no perfil dev
                        .requestMatchers("/api/client/**").hasRole("CLIENTE")
                        .requestMatchers("/api/manager/**").hasRole("GESTOR")
                        .requestMatchers("/api/me", "/api/me/**").authenticated()
                        .anyRequest().denyAll())
                .oauth2ResourceServer(o -> o
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(converter))
                        .authenticationEntryPoint(handlers)
                        .accessDeniedHandler(handlers))
                .exceptionHandling(e -> e.authenticationEntryPoint(handlers).accessDeniedHandler(handlers))
                .addFilterAfter(new RateLimitFilter(props.rateLimit(), handlers, clock),
                        BearerTokenAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    JwtDecoder jwtDecoder(JmfProperties props, Environment env, Clock clock) {
        JmfProperties.Auth auth = props.auth();
        String mode = auth.mode() == null ? "neon" : auth.mode().trim().toLowerCase();

        if ("hmac".equals(mode)) {
            if (env.acceptsProfiles(Profiles.of("prod"))) {
                throw new IllegalStateException("jmf.auth.mode=hmac é proibido no perfil prod");
            }
            byte[] secret = auth.hmacSecret() == null ? new byte[0] : auth.hmacSecret().getBytes(StandardCharsets.UTF_8);
            if (secret.length < 32) {
                throw new IllegalStateException("jmf.auth.hmac-secret precisa de ao menos 32 bytes");
            }
            NimbusJwtDecoder decoder = NimbusJwtDecoder
                    .withSecretKey(new SecretKeySpec(secret, "HmacSHA256"))
                    .macAlgorithm(MacAlgorithm.HS256)
                    .build();
            String issuer = auth.issuer() == null || auth.issuer().isBlank() ? "jmf-dev" : auth.issuer();
            decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuer));
            return decoder;
        }

        if ("supabase".equals(mode)) {
            return supabaseDecoder(auth, clock);
        }

        if (!"neon".equals(mode)) {
            throw new IllegalStateException("jmf.auth.mode inválido: " + mode);
        }
        String base = trimSlash(auth.neonBaseUrl());
        String jwksUri = auth.jwksUri() != null && !auth.jwksUri().isBlank()
                ? auth.jwksUri() : requireBase(base) + "/.well-known/jwks.json";
        String issuer = auth.issuer() != null && !auth.issuer().isBlank() ? auth.issuer() : origin(requireBase(base));
        JwksProvider jwks = new JwksProvider(URI.create(jwksUri), auth.jwksCacheTtl(), clock);
        return new NeonJwtDecoder(jwks, issuer, auth.audience(), auth.clockSkew(), clock);
    }

    /**
     * Supabase Auth: tokens assinados com chave assimétrica (ES256/RS256) são verificados pelo JWKS público
     * em {SUPABASE_URL}/auth/v1/.well-known/jwks.json. Se o projeto ainda usar o segredo JWT legado (HS256)
     * e SUPABASE_JWT_SECRET estiver definido, esses tokens são verificados com ele.
     */
    private static JwtDecoder supabaseDecoder(JmfProperties.Auth auth, Clock clock) {
        String url = trimSlash(auth.supabaseUrl());
        if (url == null || url.isBlank()) {
            throw new IllegalStateException("SUPABASE_URL é obrigatório quando jmf.auth.mode=supabase");
        }
        String authBase = url + "/auth/v1";
        String jwksUri = auth.jwksUri() != null && !auth.jwksUri().isBlank()
                ? auth.jwksUri() : authBase + "/.well-known/jwks.json";
        String issuer = auth.issuer() != null && !auth.issuer().isBlank() ? auth.issuer() : authBase;
        String audience = auth.audience() != null && !auth.audience().isBlank() ? auth.audience() : "authenticated";
        JwtDecoder asymmetric = new NeonJwtDecoder(new JwksProvider(URI.create(jwksUri), auth.jwksCacheTtl(), clock),
                issuer, audience, auth.clockSkew(), clock);

        byte[] secret = auth.supabaseJwtSecret() == null ? new byte[0]
                : auth.supabaseJwtSecret().getBytes(StandardCharsets.UTF_8);
        if (secret.length == 0) {
            return asymmetric;
        }
        if (secret.length < 32) {
            throw new IllegalStateException("SUPABASE_JWT_SECRET precisa de ao menos 32 bytes");
        }
        NimbusJwtDecoder legacy = NimbusJwtDecoder
                .withSecretKey(new SecretKeySpec(secret, "HmacSHA256"))
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        legacy.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuer),
                new JwtClaimValidator<List<String>>("aud", aud -> aud != null && aud.contains(audience))));
        return token -> {
            String alg;
            try {
                alg = JWTParser.parse(token).getHeader().getAlgorithm().getName();
            } catch (ParseException e) {
                throw new BadJwtException("Token malformado");
            }
            return "HS256".equals(alg) ? legacy.decode(token) : asymmetric.decode(token);
        };
    }

    private static String requireBase(String base) {
        if (base == null || base.isBlank()) {
            throw new IllegalStateException("NEON_AUTH_BASE_URL é obrigatório (ou defina JMF_AUTH_JWKS_URI e JMF_AUTH_ISSUER)");
        }
        return base;
    }

    private static String trimSlash(String value) {
        if (value == null) {
            return null;
        }
        String v = value.trim();
        return v.endsWith("/") ? v.substring(0, v.length() - 1) : v;
    }

    /** O "iss" dos tokens do Neon Auth é a origem da URL base (sem caminho). */
    static String origin(String url) {
        URI uri = URI.create(url);
        return uri.getScheme() + "://" + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "");
    }
}
