package br.com.jmf.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthorizationIT extends AbstractIntegrationTest {

    @Test
    void semTokenOuTokenInvalidoRetorna401NoContratoPadrao() throws Exception {
        mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.meta.requestId").exists())
                .andExpect(header().exists("X-Request-Id"));

        doGet(tokenSignedWith("joao", "user", "outro-segredo-0123456789abcdef0123456789"), "/api/me")
                .andExpect(status().isUnauthorized());
    }

    @Test
    void clienteNaoAcessaAreaDoGestor() throws Exception {
        String client = token("joao", "user");
        doGet(client, "/api/manager/overview")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
        doPatch(client, "/api/manager/settings", Map.of("weeklyPriceCents", 1)).andExpect(status().isForbidden());
        doPost(client, "/api/manager/dumpsters", Map.of("number", 1)).andExpect(status().isForbidden());
    }

    @Test
    void gestorNaoAcessaAreaDoCliente() throws Exception {
        String admin = token("admin-1", "admin");
        doGet(admin, "/api/client/dashboard").andExpect(status().isForbidden());
        doGet(admin, "/api/manager/overview").andExpect(status().isOk());
        doGet(admin, "/api/me")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.role").value("gestor"));
    }

    @Test
    void gestorSemPermissaoNaoExecutaAcoesAdministrativas() throws Exception {
        jdbc.update("""
                insert into app_users (id, auth_user_id, name, email, role)
                values ('00000000-0000-0000-0000-0000000000aa', 'gestor-limitado', 'Gestor', 'g@jmf.dev', 'gestor')
                """);
        jdbc.update("insert into user_permissions (user_id, permission) values ('00000000-0000-0000-0000-0000000000aa', 'CUSTOMERS_VIEW')");
        String limited = token("gestor-limitado", "user");

        doGet(limited, "/api/manager/overview").andExpect(status().isOk());
        doGet(limited, "/api/manager/customers").andExpect(status().isOk());
        doPatch(limited, "/api/manager/settings", Map.of("weeklyPriceCents", 1)).andExpect(status().isForbidden());
        doPost(limited, "/api/manager/dumpsters", Map.of("number", 1)).andExpect(status().isForbidden());
        doGet(limited, "/api/manager/map").andExpect(status().isForbidden());
    }

    @Test
    void clienteSoEnxergaOsProprioDados() throws Exception {
        String maria = clientWithPhone("maria");
        String joao = clientWithPhone("joao");
        JsonNode mariaRequest = data(doPost(maria, "/api/client/requests/rental", rentalBody())
                .andExpect(status().isCreated()));
        String id = mariaRequest.get("id").asText();

        doGet(joao, "/api/client/requests/" + id).andExpect(status().isNotFound());
        doPost(joao, "/api/client/requests/" + id + "/cancel", Map.of()).andExpect(status().isNotFound());
        doGet(joao, "/api/client/requests")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(0));
        doGet(maria, "/api/client/requests")
                .andExpect(jsonPath("$.data.totalItems").value(1));
    }

    @Test
    void payloadComPrecoOuDonoForjadoERejeitado() throws Exception {
        String joao = clientWithPhone("joao");
        Map<String, Object> body = rentalBody();
        body.put("priceCents", 1);
        doPost(joao, "/api/client/requests/rental", body).andExpect(status().isBadRequest());

        Map<String, Object> other = rentalBody();
        other.put("customerId", "00000000-0000-0000-0000-000000000001");
        doPost(joao, "/api/client/requests/rental", other).andExpect(status().isBadRequest());
    }
}
