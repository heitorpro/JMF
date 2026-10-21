package br.com.jmf.it;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RequestFlowIT extends AbstractIntegrationTest {

    @Test
    void telefoneEObrigatorioParaSolicitar() throws Exception {
        String joao = token("joao", "user");
        doPost(joao, "/api/client/requests/rental", rentalBody())
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("PHONE_REQUIRED"));
        doPatch(joao, "/api/me", Map.of("phone", "123"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.phone").exists());
        doPatch(joao, "/api/me", Map.of("phone", "(98) 98888-7777"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.phone").value("(98) 98888-7777"))
                .andExpect(jsonPath("$.data.profileComplete").value(true));
        assertEquals("+5598988887777", jdbc.queryForObject(
                "select c.phone from customers c join app_users u on u.id = c.user_id where u.auth_user_id = 'joao'",
                String.class));
    }

    @Test
    void enderecoInconsistenteERejeitado() throws Exception {
        String joao = clientWithPhone("joao");
        Map<String, Object> body = rentalBody();
        @SuppressWarnings("unchecked")
        Map<String, Object> location = (Map<String, Object>) body.get("location");
        location.put("latitude", 40.7);   // Nova York
        location.put("longitude", -74.0);
        doPost(joao, "/api/client/requests/rental", body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields['location.latitude']").exists());
    }

    @Test
    void fluxoCompletoDeAluguelTrocaERetirada() throws Exception {
        String admin = token("admin-1", "admin");
        doGet(admin, "/api/me"); // provisiona o gestor (recebe notificações)
        createDumpsters(admin, 1, 2, 3);
        String joao = clientWithPhone("joao");

        // 1) Aluguel: preço vem das configurações (R$ 300,00), nunca do navegador
        JsonNode rental = data(doPost(joao, "/api/client/requests/rental", rentalBody())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.priceCents").value(30000))
                .andExpect(jsonPath("$.data.status").value("pendente"))
                .andExpect(jsonPath("$.data.protocol").exists())
                .andExpect(jsonPath("$.data.location.mapsUrl")
                        .value("https://www.google.com/maps/search/?api=1&query=-2.4889,-44.2681")));
        String rentalId = rental.get("id").asText();

        advance(admin, rentalId, "aprovada");
        advance(admin, rentalId, "em_entrega")
                .andExpect(jsonPath("$.data.dumpsterNumber").value(1)); // alocação automática
        advance(admin, rentalId, "entregue");
        advance(admin, rentalId, "em_uso");

        doGet(admin, "/api/manager/dumpsters?number=1")
                .andExpect(jsonPath("$.data.items[0].status").value("ocupada"))
                .andExpect(jsonPath("$.data.items[0].customerName").value("Usuário joao"));
        doGet(joao, "/api/client/dashboard")
                .andExpect(jsonPath("$.data.activeRentals.length()").value(1))
                .andExpect(jsonPath("$.data.activeRentals[0].dumpsterNumber").value(1));

        // transição inválida → 409
        doPatch(admin, "/api/manager/requests/" + rentalId + "/status", Map.of("status", "aprovada"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("INVALID_TRANSITION"));

        // 2) Troca: a substituta só é reservada na confirmação
        JsonNode swap = data(doPost(joao, "/api/client/requests/swap",
                Map.of("desiredDate", tomorrow(), "reason", "Caçamba cheia"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("troca_solicitada"))
                .andExpect(jsonPath("$.data.dumpsterNumber").value(1)));
        String swapId = swap.get("id").asText();

        doPost(joao, "/api/client/requests/swap", Map.of("desiredDate", tomorrow(), "reason", "De novo"))
                .andExpect(status().isConflict());

        doPost(admin, "/api/manager/requests/" + swapId + "/complete-swap", Map.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("em_uso"))
                .andExpect(jsonPath("$.data.replacementDumpsterNumber").value(2));

        doGet(joao, "/api/client/requests/" + rentalId)
                .andExpect(jsonPath("$.data.request.status").value("finalizada"));
        doGet(admin, "/api/manager/dumpsters?number=1").andExpect(jsonPath("$.data.items[0].status").value("livre"));
        doGet(admin, "/api/manager/dumpsters?number=2").andExpect(jsonPath("$.data.items[0].status").value("ocupada"));

        // 3) Retirada com envio para manutenção
        JsonNode removal = data(doPost(joao, "/api/client/requests/removal",
                Map.of("desiredDate", tomorrow(), "reason", "Obra concluída"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.priceCents").value(0))
                .andExpect(jsonPath("$.data.dumpsterNumber").value(2)));
        String removalId = removal.get("id").asText();
        advance(admin, removalId, "em_retirada");
        doPatch(admin, "/api/manager/requests/" + removalId + "/status",
                Map.of("status", "finalizada", "sendToMaintenance", true))
                .andExpect(status().isOk());

        doGet(admin, "/api/manager/dumpsters?number=2").andExpect(jsonPath("$.data.items[0].status").value("manutencao"));
        doGet(joao, "/api/client/requests/" + swapId).andExpect(jsonPath("$.data.request.status").value("finalizada"));
        doGet(joao, "/api/client/rentals?status=ativo").andExpect(jsonPath("$.data.totalItems").value(0));
        doGet(joao, "/api/client/rentals").andExpect(jsonPath("$.data.totalItems").value(2));

        // 4) Auditoria e notificações
        doGet(admin, "/api/manager/requests/" + rentalId)
                .andExpect(jsonPath("$.data.events.length()").value(6)); // criação, 4 avanços, finalização
        doGet(joao, "/api/me/notifications").andExpect(jsonPath("$.data.totalItems").value(
                org.hamcrest.Matchers.greaterThan(0)));
        doGet(admin, "/api/manager/overview")
                .andExpect(jsonPath("$.data.activeRentals").value(0))
                .andExpect(jsonPath("$.data.dumpstersByStatus.manutencao").value(1));

        // request_events é imutável no banco
        assertThrows(DataAccessException.class, () -> jdbc.update("update request_events set notes = 'x'"));
        assertTrue(jdbc.queryForObject("select count(*) from audit_logs", Integer.class) > 0);
    }

    @Test
    void somenteAluguelSemanalEhAceito() throws Exception {
        String joao = clientWithPhone("joao");
        Map<String, Object> body = rentalBody();
        body.put("periodDays", 15);
        doPost(joao, "/api/client/requests/rental", body).andExpect(status().isBadRequest());
    }

    @Test
    void enderecoSemCepUsaSaoLuisMaFixos() throws Exception {
        String joao = clientWithPhone("joao");
        Map<String, Object> body = rentalBody();
        @SuppressWarnings("unchecked")
        Map<String, Object> location = (Map<String, Object>) body.get("location");
        location.remove("postalCode");
        location.put("number", "S/N");
        location.put("complement", "Ref.: Shopping Rio Anil");
        location.put("city", "Outra cidade");
        location.put("state", "PI");
        doPost(joao, "/api/client/requests/rental", body)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.location.city").value("São Luís"))
                .andExpect(jsonPath("$.data.location.state").value("MA"))
                .andExpect(jsonPath("$.data.location.number").value("S/N"));

        Map<String, Object> noStreet = rentalBody();
        @SuppressWarnings("unchecked")
        Map<String, Object> loc2 = (Map<String, Object>) noStreet.get("location");
        loc2.remove("street");
        doPost(joao, "/api/client/requests/rental", noStreet).andExpect(status().isBadRequest());
    }

    @Test
    void versaoDeSincronizacaoMudaQuandoAlgoMuda() throws Exception {
        String admin = token("admin-1", "admin");
        String joao = clientWithPhone("joao");
        String before = data(doGet(admin, "/api/me/sync").andExpect(status().isOk())).get("version").asText();
        doPost(joao, "/api/client/requests/rental", rentalBody()).andExpect(status().isCreated());
        String after = data(doGet(admin, "/api/me/sync").andExpect(status().isOk())).get("version").asText();
        org.junit.jupiter.api.Assertions.assertNotEquals(before, after);
    }

    @Test
    void rejeicaoECancelamento() throws Exception {
        String admin = token("admin-1", "admin");
        String joao = clientWithPhone("joao");
        String first = data(doPost(joao, "/api/client/requests/rental", rentalBody())).get("id").asText();
        String second = data(doPost(joao, "/api/client/requests/rental", rentalBody())).get("id").asText();

        doPatch(admin, "/api/manager/requests/" + first + "/status", Map.of("status", "rejeitada", "notes", "Sem rota"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("rejeitada"));
        doPost(joao, "/api/client/requests/" + second + "/cancel", Map.of("reason", "Desisti"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("cancelada"));
        doPost(joao, "/api/client/requests/" + first + "/cancel", Map.of())
                .andExpect(status().isConflict());
    }

    @Test
    void cacambaOcupadaNaoMudaDeStatusManualmente() throws Exception {
        String admin = token("admin-1", "admin");
        createDumpsters(admin, 7);
        String id = data(doGet(admin, "/api/manager/dumpsters?number=7")).get("items").get(0).get("id").asText();
        doPatch(admin, "/api/manager/dumpsters/" + id, Map.of("status", "ocupada"))
                .andExpect(status().isUnprocessableEntity());
        doPatch(admin, "/api/manager/dumpsters/" + id, Map.of("status", "manutencao", "notes", "Solda"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("manutencao"));
        doPost(admin, "/api/manager/dumpsters", Map.of("number", 7)).andExpect(status().isConflict());
    }

    private org.springframework.test.web.servlet.ResultActions advance(String admin, String id, String to)
            throws Exception {
        return doPatch(admin, "/api/manager/requests/" + id + "/status", Map.of("status", to))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(to));
    }
}
