package br.com.jmf.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DatabaseUrlParserTest {

    @Test
    void converteUrlDoNeonParaJdbc() {
        DatabaseUrlParser.JdbcConfig cfg = DatabaseUrlParser.parse(
                "postgresql://neondb_owner:s3cr%40t@ep-cool-123-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");
        assertEquals("jdbc:postgresql://ep-cool-123-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require", cfg.url());
        assertEquals("neondb_owner", cfg.username());
        assertEquals("s3cr@t", cfg.password());
    }

    @Test
    void adicionaSslModeEPreservaPorta() {
        DatabaseUrlParser.JdbcConfig cfg = DatabaseUrlParser.parse("postgres://u:p@localhost:5433/jmf");
        assertEquals("jdbc:postgresql://localhost:5433/jmf?sslmode=require", cfg.url());
    }

    @Test
    void urlJdbcPassaDireto() {
        assertEquals("jdbc:postgresql://h/db", DatabaseUrlParser.parse("jdbc:postgresql://h/db").url());
    }

    @Test
    void rejeitaOutrosEsquemas() {
        assertThrows(IllegalArgumentException.class, () -> DatabaseUrlParser.parse("mysql://u:p@h/db"));
    }
}
