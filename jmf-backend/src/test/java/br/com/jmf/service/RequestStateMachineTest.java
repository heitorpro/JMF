package br.com.jmf.service;

import br.com.jmf.domain.model.RequestStatus;
import br.com.jmf.domain.model.RequestType;
import org.junit.jupiter.api.Test;

import static br.com.jmf.domain.model.RequestStatus.APROVADA;
import static br.com.jmf.domain.model.RequestStatus.CANCELADA;
import static br.com.jmf.domain.model.RequestStatus.EM_ENTREGA;
import static br.com.jmf.domain.model.RequestStatus.EM_RETIRADA;
import static br.com.jmf.domain.model.RequestStatus.EM_TROCA;
import static br.com.jmf.domain.model.RequestStatus.EM_USO;
import static br.com.jmf.domain.model.RequestStatus.ENTREGUE;
import static br.com.jmf.domain.model.RequestStatus.FINALIZADA;
import static br.com.jmf.domain.model.RequestStatus.PENDENTE;
import static br.com.jmf.domain.model.RequestStatus.REJEITADA;
import static br.com.jmf.domain.model.RequestStatus.RETIRADA_SOLICITADA;
import static br.com.jmf.domain.model.RequestStatus.TROCA_SOLICITADA;
import static br.com.jmf.domain.model.RequestType.ALUGUEL;
import static br.com.jmf.domain.model.RequestType.RETIRADA;
import static br.com.jmf.domain.model.RequestType.TROCA;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RequestStateMachineTest {

    @Test
    void fluxoDeAluguelIgualAoFrontend() {
        assertEquals(APROVADA, RequestStateMachine.next(ALUGUEL, PENDENTE));
        assertEquals(EM_ENTREGA, RequestStateMachine.next(ALUGUEL, APROVADA));
        assertEquals(ENTREGUE, RequestStateMachine.next(ALUGUEL, EM_ENTREGA));
        assertEquals(EM_USO, RequestStateMachine.next(ALUGUEL, ENTREGUE));
        assertNull(RequestStateMachine.next(ALUGUEL, EM_USO));
    }

    @Test
    void fluxoDeRetiradaETroca() {
        assertEquals(EM_RETIRADA, RequestStateMachine.next(RETIRADA, RETIRADA_SOLICITADA));
        assertEquals(FINALIZADA, RequestStateMachine.next(RETIRADA, EM_RETIRADA));
        assertEquals(EM_TROCA, RequestStateMachine.next(TROCA, TROCA_SOLICITADA));
        assertNull(RequestStateMachine.next(TROCA, EM_TROCA), "troca termina via complete-swap");
    }

    @Test
    void naoPermitePularEtapasNemVoltar() {
        assertFalse(RequestStateMachine.canTransition(ALUGUEL, PENDENTE, EM_ENTREGA));
        assertFalse(RequestStateMachine.canTransition(ALUGUEL, ENTREGUE, APROVADA));
        assertFalse(RequestStateMachine.canTransition(ALUGUEL, PENDENTE, FINALIZADA));
        assertFalse(RequestStateMachine.canTransition(RETIRADA, RETIRADA_SOLICITADA, FINALIZADA));
        assertFalse(RequestStateMachine.canTransition(ALUGUEL, PENDENTE, null));
    }

    @Test
    void rejeicaoSomenteAntesDaCacambaSair() {
        assertTrue(RequestStateMachine.canTransition(ALUGUEL, PENDENTE, REJEITADA));
        assertTrue(RequestStateMachine.canTransition(ALUGUEL, APROVADA, REJEITADA));
        assertFalse(RequestStateMachine.canTransition(ALUGUEL, EM_ENTREGA, REJEITADA));
        assertFalse(RequestStateMachine.canTransition(ALUGUEL, EM_USO, REJEITADA));
        assertTrue(RequestStateMachine.canTransition(TROCA, EM_TROCA, REJEITADA));
    }

    @Test
    void cancelamentoPeloCliente() {
        assertTrue(RequestStateMachine.canCancel(ALUGUEL, PENDENTE));
        assertFalse(RequestStateMachine.canCancel(ALUGUEL, EM_ENTREGA));
        assertTrue(RequestStateMachine.canCancel(TROCA, TROCA_SOLICITADA));
        assertFalse(RequestStateMachine.canCancel(TROCA, EM_TROCA));
    }

    @Test
    void estadosTerminaisNaoAvancam() {
        for (RequestType type : RequestType.values()) {
            for (RequestStatus terminal : RequestStateMachine.TERMINAL) {
                assertNull(RequestStateMachine.next(type, terminal));
                assertFalse(RequestStateMachine.canTransition(type, terminal, REJEITADA));
                assertFalse(RequestStateMachine.canCancel(type, terminal));
            }
        }
        assertTrue(RequestStateMachine.isTerminal(CANCELADA));
    }

    @Test
    void alocacaoEConclusaoDeTroca() {
        assertTrue(RequestStateMachine.canAllocate(ALUGUEL, PENDENTE));
        assertFalse(RequestStateMachine.canAllocate(ALUGUEL, EM_ENTREGA));
        assertFalse(RequestStateMachine.canAllocate(TROCA, TROCA_SOLICITADA));
        assertTrue(RequestStateMachine.canCompleteSwap(TROCA, TROCA_SOLICITADA));
        assertTrue(RequestStateMachine.canCompleteSwap(TROCA, EM_TROCA));
        assertFalse(RequestStateMachine.canCompleteSwap(RETIRADA, RETIRADA_SOLICITADA));
    }
}
