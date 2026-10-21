package br.com.jmf.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Cache curto do usuário resolvido a partir do token. Sem ele, cada requisição faria de 2 a 4 consultas
 * ao banco só para identificar o usuário — e o painel faz várias requisições por ação.
 *
 * <p>A chave inclui as claims usadas na resolução (sub, e-mail, nome, papéis), então um token novo com
 * dados diferentes é resolvido de novo. Alterações feitas no próprio perfil invalidam a entrada
 * ({@link #evict}); mudanças de papel/permissão feitas direto no banco valem em até {@code ttlSeconds}.
 * {@code jmf.auth.user-cache-seconds: 0} desliga o cache (usado nos testes).</p>
 */
@Component
public class CurrentUserCache {

    private static final int MAX_ENTRIES = 5_000;

    private record Entry(CurrentUser user, long expiresAt) {
    }

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();
    private final long ttlMillis;

    public CurrentUserCache(@Value("${jmf.auth.user-cache-seconds:20}") long ttlSeconds) {
        this.ttlMillis = Math.max(0, ttlSeconds) * 1000;
    }

    public CurrentUser get(String key, Supplier<CurrentUser> loader) {
        if (ttlMillis == 0) {
            return loader.get();
        }
        long now = System.currentTimeMillis();
        Entry hit = entries.get(key);
        if (hit != null && hit.expiresAt() > now) {
            return hit.user();
        }
        CurrentUser user = loader.get();
        if (entries.size() >= MAX_ENTRIES) {
            entries.values().removeIf(e -> e.expiresAt() <= now);
            if (entries.size() >= MAX_ENTRIES) {
                entries.clear();
            }
        }
        entries.put(key, new Entry(user, now + ttlMillis));
        return user;
    }

    /** Remove as entradas do usuário (pelo id do Neon Auth). */
    public void evict(String authUserId) {
        String prefix = authUserId + '|';
        entries.keySet().removeIf(k -> k.startsWith(prefix));
    }
}
