package br.com.jmf.security;

import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Baixa e mantém em cache o JWKS do Neon Auth. Em caso de "kid" desconhecido (rotação de chave),
 * força um novo download — no máximo uma vez a cada {@link #MIN_REFRESH_INTERVAL}.
 */
public class JwksProvider {

    private static final Logger log = LoggerFactory.getLogger(JwksProvider.class);
    private static final Duration MIN_REFRESH_INTERVAL = Duration.ofSeconds(30);

    private final URI jwksUri;
    private final Duration ttl;
    private final Clock clock;
    private final HttpClient http;

    private final ReentrantLock lock = new ReentrantLock(); // sem pinning de virtual threads
    private volatile JWKSet cached;
    private volatile Instant fetchedAt = Instant.EPOCH;

    public JwksProvider(URI jwksUri, Duration ttl, Clock clock) {
        this.jwksUri = jwksUri;
        this.ttl = ttl == null ? Duration.ofMinutes(10) : ttl;
        this.clock = clock;
        this.http = HttpClient.newBuilder()
                .proxy(ProxySelector.getDefault())
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    public Optional<JWK> find(String keyId) {
        JWKSet set = current(false);
        JWK key = select(set, keyId);
        if (key == null) {
            set = current(true);
            key = select(set, keyId);
        }
        return Optional.ofNullable(key);
    }

    private static JWK select(JWKSet set, String keyId) {
        if (set == null) {
            return null;
        }
        if (keyId != null) {
            return set.getKeyByKeyId(keyId);
        }
        // Sem "kid": aceitável apenas se o JWKS tiver uma única chave.
        return set.getKeys().size() == 1 ? set.getKeys().get(0) : null;
    }

    private JWKSet current(boolean forceRefresh) {
        lock.lock();
        try {
            return refreshIfNeeded(forceRefresh);
        } finally {
            lock.unlock();
        }
    }

    private JWKSet refreshIfNeeded(boolean forceRefresh) {
        Instant now = clock.instant();
        boolean expired = cached == null || now.isAfter(fetchedAt.plus(ttl));
        boolean mayForce = forceRefresh && now.isAfter(fetchedAt.plus(MIN_REFRESH_INTERVAL));
        if (expired || mayForce) {
            try {
                HttpRequest request = HttpRequest.newBuilder(jwksUri)
                        .timeout(Duration.ofSeconds(5))
                        .header("Accept", "application/json")
                        .GET().build();
                HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() != 200) {
                    throw new IllegalStateException("HTTP " + response.statusCode());
                }
                cached = JWKSet.parse(response.body());
                fetchedAt = now;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("Falha ao atualizar JWKS: interrompido");
            } catch (Exception e) {
                // Mantém o cache anterior (se houver) para tolerar indisponibilidade momentânea.
                log.warn("Falha ao atualizar JWKS: {}", e.getClass().getSimpleName());
                fetchedAt = cached == null ? Instant.EPOCH : now.minus(ttl).plus(MIN_REFRESH_INTERVAL);
            }
        }
        return cached;
    }
}
