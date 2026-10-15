package br.com.jmf.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Converte a URL no formato do Neon/Vercel ("postgresql://user:senha@host/db?sslmode=require")
 * no formato JDBC usado pelo driver Java.
 */
public final class DatabaseUrlParser {

    /** Parâmetros libpq que o pgjdbc não entende com o mesmo nome. */
    private static final Set<String> DROPPED_PARAMS = Set.of("channel_binding", "pgbouncer", "connect_timeout");

    public record JdbcConfig(String url, String username, String password) {
    }

    private DatabaseUrlParser() {
    }

    public static JdbcConfig parse(String databaseUrl) {
        if (databaseUrl == null || databaseUrl.isBlank()) {
            throw new IllegalArgumentException("URL de banco vazia");
        }
        String value = databaseUrl.trim();
        if (value.startsWith("jdbc:")) {
            return new JdbcConfig(value, null, null);
        }
        URI uri = URI.create(value);
        String scheme = uri.getScheme();
        if (!"postgres".equals(scheme) && !"postgresql".equals(scheme)) {
            throw new IllegalArgumentException("Esquema de URL de banco não suportado");
        }
        String username = null;
        String password = null;
        String userInfo = uri.getRawUserInfo();
        if (userInfo != null) {
            int colon = userInfo.indexOf(':');
            username = decode(colon >= 0 ? userInfo.substring(0, colon) : userInfo);
            password = colon >= 0 ? decode(userInfo.substring(colon + 1)) : null;
        }
        StringBuilder jdbc = new StringBuilder("jdbc:postgresql://").append(uri.getHost());
        if (uri.getPort() > 0) {
            jdbc.append(':').append(uri.getPort());
        }
        String path = uri.getRawPath();
        jdbc.append(path == null || path.isEmpty() ? "/" : path);

        List<String> params = new ArrayList<>();
        if (uri.getRawQuery() != null) {
            for (String pair : uri.getRawQuery().split("&")) {
                String key = pair.contains("=") ? pair.substring(0, pair.indexOf('=')) : pair;
                if (!key.isEmpty() && !DROPPED_PARAMS.contains(key)) {
                    params.add(pair);
                }
            }
        }
        if (params.stream().noneMatch(p -> p.startsWith("sslmode="))) {
            params.add("sslmode=require");
        }
        jdbc.append('?').append(String.join("&", params));
        return new JdbcConfig(jdbc.toString(), username, password);
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }
}
