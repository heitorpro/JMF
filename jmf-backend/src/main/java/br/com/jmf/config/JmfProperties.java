package br.com.jmf.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.List;

/** Configurações da aplicação (prefixo "jmf"). Valores padrão em application.yml. */
@ConfigurationProperties(prefix = "jmf")
public record JmfProperties(
        Auth auth,
        Cors cors,
        RateLimit rateLimit,
        ServiceArea serviceArea,
        Storage storage,
        Http http,
        Requests requests) {

    /**
     * @param mode       "neon" (produção: JWT EdDSA do Neon Auth via JWKS) ou "hmac" (somente dev/test)
     * @param neonBaseUrl NEON_AUTH_BASE_URL; JWKS e issuer são derivados dele quando não informados
     * @param adminRoles valores da claim "role" que concedem papel de gestor com todas as permissões
     */
    public record Auth(String mode, String neonBaseUrl, String jwksUri, String issuer, String audience,
                       String hmacSecret, Duration jwksCacheTtl, Duration clockSkew, List<String> adminRoles) {
    }

    public record Cors(List<String> allowedOrigins) {
    }

    public record RateLimit(boolean enabled, int writesPerMinute, int geocodePerMinute, int uploadsPerMinute,
                            int readsPerMinute) {
    }

    /** Área atendida: valida que o endereço está dentro do raio de operação. */
    public record ServiceArea(boolean enabled, double centerLatitude, double centerLongitude, double radiusKm,
                              List<String> allowedStates) {
    }

    public record Storage(String localDir, long maxBytes) {
    }

    public record Http(String contentSecurityPolicy) {
    }

    /** Antecedência máxima (dias) para a data desejada de uma solicitação. */
    public record Requests(int maxDaysAhead) {
    }
}
