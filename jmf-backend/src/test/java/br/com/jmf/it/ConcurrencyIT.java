package br.com.jmf.it;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

/** Critério de aceite: duas operações concorrentes não reservam a mesma caçamba. */
class ConcurrencyIT extends AbstractIntegrationTest {

    @Test
    void duasAlocacoesSimultaneasDaMesmaCacambaResultamEmUmConflito() throws Exception {
        String admin = token("admin-1", "admin");
        createDumpsters(admin, 1);
        String dumpsterId = data(doGet(admin, "/api/manager/dumpsters?number=1")).get("items").get(0).get("id").asText();
        String a = data(doPost(clientWithPhone("ana"), "/api/client/requests/rental", rentalBody())).get("id").asText();
        String b = data(doPost(clientWithPhone("bia"), "/api/client/requests/rental", rentalBody())).get("id").asText();

        List<Integer> statuses = race(
                () -> doPost(admin, "/api/manager/requests/" + a + "/allocate", Map.of("dumpsterId", dumpsterId))
                        .andReturn().getResponse().getStatus(),
                () -> doPost(admin, "/api/manager/requests/" + b + "/allocate", Map.of("dumpsterId", dumpsterId))
                        .andReturn().getResponse().getStatus());

        statuses.sort(Integer::compareTo);
        assertEquals(List.of(200, 409), statuses);
        assertEquals(1, jdbc.queryForObject(
                "select count(*) from rental_requests where dumpster_id = ?::uuid", Integer.class, dumpsterId));
    }

    @Test
    void alocacoesAutomaticasSimultaneasPegamCacambasDiferentes() throws Exception {
        String admin = token("admin-1", "admin");
        createDumpsters(admin, 1, 2);
        String a = data(doPost(clientWithPhone("ana"), "/api/client/requests/rental", rentalBody())).get("id").asText();
        String b = data(doPost(clientWithPhone("bia"), "/api/client/requests/rental", rentalBody())).get("id").asText();

        List<Integer> statuses = race(
                () -> doPost(admin, "/api/manager/requests/" + a + "/allocate", Map.of())
                        .andReturn().getResponse().getStatus(),
                () -> doPost(admin, "/api/manager/requests/" + b + "/allocate", Map.of())
                        .andReturn().getResponse().getStatus());

        assertEquals(List.of(200, 200), statuses);
        List<String> allocated = jdbc.queryForList(
                "select dumpster_id::text from rental_requests where dumpster_id is not null", String.class);
        assertEquals(2, allocated.size());
        assertNotEquals(allocated.get(0), allocated.get(1));
    }

    @SafeVarargs
    private static List<Integer> race(Callable<Integer>... tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.length);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Integer>> futures = new ArrayList<>();
            for (Callable<Integer> task : tasks) {
                futures.add(pool.submit(() -> {
                    start.await();
                    return task.call();
                }));
            }
            start.countDown();
            List<Integer> results = new ArrayList<>();
            for (Future<Integer> f : futures) {
                results.add(f.get());
            }
            return results;
        } finally {
            pool.shutdownNow();
        }
    }
}
