package br.com.jmf.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Base dos testes de integração: PostgreSQL real (Testcontainers, requer Docker), migrações Flyway
 * reais e tokens HS256 emitidos com o segredo do perfil "test".
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {

    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    static final String SECRET = "test-secret-0123456789abcdef0123456789abcdef";

    static {
        POSTGRES.start(); // singleton: compartilhado entre classes e pelo cache de contexto do Spring
    }

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
        registry.add("spring.flyway.user", POSTGRES::getUsername);
        registry.add("spring.flyway.password", POSTGRES::getPassword);
    }

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected ObjectMapper json;

    @Autowired
    protected JdbcTemplate jdbc;

    @BeforeEach
    void cleanDatabase() {
        // TRUNCATE não dispara os triggers de imutabilidade (que são por linha, em UPDATE/DELETE).
        jdbc.execute("""
                truncate table notifications, audit_logs, request_events, rentals, rental_requests,
                               attachments, dumpsters, locations, customers, user_permissions, app_users cascade
                """);

        jdbc.update("""
                insert into company_settings (id, weekly_price_cents, period_days, email, address)
                values (1, 30000, 7, 'atendimento@jmfentulhos.com.br', 'São Luís, Maranhão')
                on conflict (id) do nothing
                """);
    }

    

    // ------------------------------------------------------------------ tokens

    protected static String token(String sub, String role) {
        return tokenSignedWith(sub, role, SECRET);
    }

    protected static String tokenSignedWith(String sub, String role, String secret) {
        try {
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .subject(sub)
                    .issuer("jmf-test")
                    .issueTime(new Date())
                    .expirationTime(Date.from(Instant.now().plusSeconds(3600)))
                    .claim("email", sub + "@teste.dev")
                    .claim("name", "Usuário " + sub)
                    .claim("role", role)
                    .build();
            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
            jwt.sign(new MACSigner(secret.getBytes(StandardCharsets.UTF_8)));
            return jwt.serialize();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    // ------------------------------------------------------------------ HTTP

    protected ResultActions doGet(String token, String url) throws Exception {
        return mvc.perform(get(url).header("Authorization", "Bearer " + token));
    }

    protected ResultActions doPost(String token, String url, Object body) throws Exception {
        return mvc.perform(post(url).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body)));
    }

    protected ResultActions doPatch(String token, String url, Object body) throws Exception {
        return mvc.perform(patch(url).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body)));
    }

    protected JsonNode data(ResultActions actions) throws Exception {
        MvcResult result = actions.andReturn();
        return json.readTree(result.getResponse().getContentAsByteArray()).get("data");
    }

    // ------------------------------------------------------------------ fixtures

    protected static String tomorrow() {
        return LocalDate.now(ZoneId.of("America/Fortaleza")).plusDays(1).toString();
    }

    protected static Map<String, Object> saoLuisLocation() {
        Map<String, Object> location = new LinkedHashMap<>();
        location.put("postalCode", "65075-000");
        location.put("street", "Avenida dos Holandeses");
        location.put("number", "120");
        location.put("neighborhood", "Calhau");
        location.put("city", "São Luís");
        location.put("state", "MA");
        location.put("latitude", -2.4889);
        location.put("longitude", -44.2681);
        location.put("source", "gps");
        return location;
    }

    protected static Map<String, Object> rentalBody() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("desiredDate", tomorrow());
        body.put("location", saoLuisLocation());
        body.put("details", "Reforma de banheiro");
        return body;
    }

    /** Cria o cliente (primeiro acesso) e grava o telefone obrigatório. */
    protected String clientWithPhone(String sub) throws Exception {
        String token = token(sub, "user");
        doPatch(token, "/api/me", Map.of("phone", "(98) 98888-7777"));
        return token;
    }

    protected void createDumpsters(String adminToken, int... numbers) throws Exception {
        for (int n : numbers) {
            doPost(adminToken, "/api/manager/dumpsters", Map.of("number", n));
        }
    }
}
