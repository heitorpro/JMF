package br.com.jmf.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * "Versão" dos dados exibidos nos painéis: muda sempre que uma solicitação, locação, caçamba,
 * configuração ou notificação do usuário é criada ou alterada. O frontend consulta este valor a cada
 * poucos segundos (consulta leve) e só recarrega os dados completos quando ele muda.
 * Não expõe dados: apenas carimbos de tempo e contagens agregadas.
 */
@Service
public class SyncService {

    private static final String SQL = """
            select concat_ws('|',
              (select max(updated_at) from rental_requests),
              (select count(*)        from rental_requests),
              (select max(updated_at) from rentals),
              (select max(updated_at) from dumpsters),
              (select max(updated_at) from company_settings),
              (select max(coalesce(read_at, created_at)) from notifications where user_id = ?),
              (select count(*)        from notifications where user_id = ?))
            """;

    private final JdbcTemplate jdbc;

    public SyncService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public String version(UUID userId) {
        String raw = jdbc.queryForObject(SQL, String.class, userId, userId);
        return Integer.toHexString(raw == null ? 0 : raw.hashCode());
    }
}
