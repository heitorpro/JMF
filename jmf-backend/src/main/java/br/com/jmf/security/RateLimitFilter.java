package br.com.jmf.security;

import br.com.jmf.common.ErrorCode;
import br.com.jmf.config.JmfProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Rate limit em janela fixa de 1 minuto, por usuário autenticado (ou IP) e por grupo de rota.
 * Em memória: adequado para uma instância. Com várias réplicas, troque por Redis/Upstash
 * mantendo a mesma interface (ver docs/DECISOES.md).
 * Cadastro e login ficam no Neon Auth, que aplica seus próprios limites.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_TRACKED_KEYS = 50_000;

    private final JmfProperties.RateLimit config;
    private final JsonSecurityHandlers writer;
    private final Clock clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public RateLimitFilter(JmfProperties.RateLimit config, JsonSecurityHandlers writer, Clock clock) {
        this.config = config;
        this.writer = writer;
        this.clock = clock;
    }

    /** Até 2 verificações por segundo por usuário (o painel usa 1 a cada 3 s, por aba). */
    static final int SYNC_PER_MINUTE = 120;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return config == null || !config.enabled() || !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String group = group(request);
        int limit = switch (group) {
            case "write" -> config.writesPerMinute();
            case "geocode" -> config.geocodePerMinute();
            case "upload" -> config.uploadsPerMinute();
            case "sync" -> SYNC_PER_MINUTE;
            default -> config.readsPerMinute();
        };
        long minute = clock.millis() / 60_000;
        String key = group + ':' + principal(request);

        if (windows.size() > MAX_TRACKED_KEYS) {
            windows.values().removeIf(w -> w.minute < minute);
        }
        Window window = windows.compute(key, (k, w) -> w == null || w.minute != minute ? new Window(minute) : w);
        int count = window.counter.incrementAndGet();

        if (count > limit) {
            long retryAfter = 60 - (clock.millis() / 1000) % 60;
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            writer.write(response, ErrorCode.RATE_LIMITED);
            return;
        }
        chain.doFilter(request, response);
    }

    static String group(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();
        if ("POST".equals(method) && path.equals("/api/client/locations/resolve")) {
            return "geocode";
        }
        if ("GET".equals(method) && path.equals("/api/me/sync")) {
            return "sync"; // verificação leve a cada poucos segundos; limite próprio
        }
        if ("POST".equals(method) && path.equals("/api/client/attachments")) {
            return "upload";
        }
        if ("POST".equals(method) && path.startsWith("/api/client/requests")) {
            return "write";
        }
        return "read";
    }

    private static String principal(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JmfAuthenticationToken token) {
            return "u:" + token.getCurrentUser().userId();
        }
        return "ip:" + request.getRemoteAddr();
    }

    private static final class Window {
        final long minute;
        final AtomicInteger counter = new AtomicInteger();

        Window(long minute) {
            this.minute = minute;
        }
    }
}
