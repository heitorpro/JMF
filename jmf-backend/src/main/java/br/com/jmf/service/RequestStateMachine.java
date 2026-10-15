package br.com.jmf.service;

import br.com.jmf.domain.model.RequestStatus;
import br.com.jmf.domain.model.RequestType;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

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

/**
 * Máquina de estados das solicitações (regra 4). Espelha {@code getNextRequestStatus} do frontend
 * e acrescenta rejeição, cancelamento e conclusão de troca.
 *
 * <pre>
 * aluguel : pendente → aprovada → em_entrega → entregue → em_uso → (finalizada pela retirada)
 * troca   : troca_solicitada → em_troca → em_uso (via complete-swap) → (finalizada pela retirada/nova troca)
 * retirada: retirada_solicitada → em_retirada → finalizada
 * rejeição (gestor) : estados iniciais, antes de a caçamba sair do pátio
 * cancelamento (cliente): somente estados de solicitação ainda não atendida
 * </pre>
 */
public final class RequestStateMachine {

    private static final Map<RequestType, Map<RequestStatus, RequestStatus>> ADVANCE = Map.of(
            RequestType.ALUGUEL, Map.of(
                    PENDENTE, APROVADA,
                    APROVADA, EM_ENTREGA,
                    EM_ENTREGA, ENTREGUE,
                    ENTREGUE, EM_USO),
            RequestType.TROCA, Map.of(
                    TROCA_SOLICITADA, EM_TROCA),
            RequestType.RETIRADA, Map.of(
                    RETIRADA_SOLICITADA, EM_RETIRADA,
                    EM_RETIRADA, FINALIZADA));

    private static final Map<RequestType, Set<RequestStatus>> REJECTABLE = Map.of(
            RequestType.ALUGUEL, EnumSet.of(PENDENTE, APROVADA),
            RequestType.TROCA, EnumSet.of(TROCA_SOLICITADA, EM_TROCA),
            RequestType.RETIRADA, EnumSet.of(RETIRADA_SOLICITADA, EM_RETIRADA));

    private static final Map<RequestType, Set<RequestStatus>> CANCELLABLE = Map.of(
            RequestType.ALUGUEL, EnumSet.of(PENDENTE, APROVADA),
            RequestType.TROCA, EnumSet.of(TROCA_SOLICITADA),
            RequestType.RETIRADA, EnumSet.of(RETIRADA_SOLICITADA));

    /** Estados que aguardam ação do gestor (badge de pendências no frontend). */
    public static final Set<RequestStatus> AWAITING_MANAGER = EnumSet.of(PENDENTE, TROCA_SOLICITADA, RETIRADA_SOLICITADA);

    /** Estados finais. */
    public static final Set<RequestStatus> TERMINAL = EnumSet.of(FINALIZADA, CANCELADA, REJEITADA);

    /** Estados de reserva de caçamba para aluguel (antes de virar "ocupada"). */
    public static final Set<RequestStatus> RESERVING = EnumSet.of(PENDENTE, APROVADA, EM_ENTREGA);

    /** Solicitações que ainda exigem logística (aparecem no mapa). */
    public static final Set<RequestStatus> OPEN_LOGISTICS = EnumSet.of(PENDENTE, APROVADA, EM_ENTREGA,
            TROCA_SOLICITADA, EM_TROCA, RETIRADA_SOLICITADA, EM_RETIRADA);

    private RequestStateMachine() {
    }

    public static RequestStatus initialStatus(RequestType type) {
        return switch (type) {
            case ALUGUEL -> PENDENTE;
            case TROCA -> TROCA_SOLICITADA;
            case RETIRADA -> RETIRADA_SOLICITADA;
        };
    }

    /** Próximo estado no fluxo normal, ou null se não houver avanço manual. */
    public static RequestStatus next(RequestType type, RequestStatus current) {
        return ADVANCE.get(type).get(current);
    }

    /** O gestor pode mover de {@code from} para {@code to} via PATCH /status? */
    public static boolean canTransition(RequestType type, RequestStatus from, RequestStatus to) {
        if (to == REJEITADA) {
            return REJECTABLE.get(type).contains(from);
        }
        return to != null && to == next(type, from);
    }

    public static boolean canCancel(RequestType type, RequestStatus current) {
        return CANCELLABLE.get(type).contains(current);
    }

    /** Troca pode ser concluída enquanto solicitada ou em andamento. */
    public static boolean canCompleteSwap(RequestType type, RequestStatus current) {
        return type == RequestType.TROCA && (current == TROCA_SOLICITADA || current == EM_TROCA);
    }

    /** Alocação/realocação de caçamba é permitida antes da saída para entrega. */
    public static boolean canAllocate(RequestType type, RequestStatus current) {
        return type == RequestType.ALUGUEL && (current == PENDENTE || current == APROVADA);
    }

    public static boolean isTerminal(RequestStatus status) {
        return TERMINAL.contains(status);
    }
}
