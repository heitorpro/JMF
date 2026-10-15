package br.com.jmf.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.HashMap;
import java.util.Map;

/**
 * Reaproveita as variáveis já existentes no projeto (DATABASE_URL, DATABASE_URL_UNPOOLED,
 * POSTGRES_URL, POSTGRES_URL_NON_POOLING) sem exigir variáveis duplicadas no formato JDBC.
 * <ul>
 *   <li>Aplicação: DATABASE_URL (pooled) → spring.datasource.*</li>
 *   <li>Migrações: DATABASE_URL_UNPOOLED (conexão direta) → spring.flyway.*</li>
 * </ul>
 * Se spring.datasource.url / spring.flyway.url já estiverem definidos, nada é alterado.
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment env, SpringApplication application) {
        // Desligado nos testes para nunca apontar migrações para um banco real por engano.
        if (!env.getProperty("jmf.database-url-env.enabled", Boolean.class, true)) {
            return;
        }
        Map<String, Object> props = new HashMap<>();

        if (!env.containsProperty("spring.datasource.url")) {
            String pooled = first(env, "DATABASE_URL", "POSTGRES_URL");
            if (pooled != null) {
                put(props, "spring.datasource", "username", DatabaseUrlParser.parse(pooled));
            }
        }
        if (!env.containsProperty("spring.flyway.url")) {
            String direct = first(env, "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING");
            if (direct != null) {
                put(props, "spring.flyway", "user", DatabaseUrlParser.parse(direct));
            }
        }
        if (!props.isEmpty()) {
            env.getPropertySources().addLast(new MapPropertySource("jmfDatabaseUrls", props));
        }
    }

    private static void put(Map<String, Object> props, String prefix, String userKey,
                            DatabaseUrlParser.JdbcConfig cfg) {
        props.put(prefix + ".url", cfg.url());
        if (cfg.username() != null) {
            props.put(prefix + "." + userKey, cfg.username());
        }
        if (cfg.password() != null) {
            props.put(prefix + ".password", cfg.password());
        }
    }

    private static String first(ConfigurableEnvironment env, String... names) {
        for (String name : names) {
            String value = env.getProperty(name);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
