package br.com.jmf.service;

import br.com.jmf.common.ApiException;
import br.com.jmf.common.ErrorCode;
import br.com.jmf.common.TextSanitizer;
import br.com.jmf.domain.model.Customer;
import br.com.jmf.domain.model.Dumpster;
import br.com.jmf.domain.model.DumpsterStatus;
import br.com.jmf.domain.model.Rental;
import br.com.jmf.domain.model.RentalOperation;
import br.com.jmf.domain.model.RentalRequest;
import br.com.jmf.domain.model.RequestStatus;
import br.com.jmf.domain.repository.DumpsterRepository;
import br.com.jmf.domain.repository.RentalRepository;
import br.com.jmf.domain.repository.RentalRequestRepository;
import br.com.jmf.security.CurrentUser;
import br.com.jmf.web.dto.Inputs;
import br.com.jmf.web.dto.Views;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * Fluxo operacional do gestor. Cada operação roda em UMA transação (regra 5) e trava as linhas
 * envolvidas com SELECT ... FOR UPDATE; os índices únicos parciais do banco são a última barreira
 * contra reservas duplicadas (regra 3).
 */
@Service
public class RequestWorkflowService {

    private final RentalRequestRepository requests;
    private final DumpsterRepository dumpsters;
    private final RentalRepository rentals;
    private final AuditService audit;
    private final NotificationService notifications;
    private final Clock clock;

    public RequestWorkflowService(RentalRequestRepository requests, DumpsterRepository dumpsters,
                                  RentalRepository rentals, AuditService audit, NotificationService notifications,
                                  Clock clock) {
        this.requests = requests;
        this.dumpsters = dumpsters;
        this.rentals = rentals;
        this.audit = audit;
        this.notifications = notifications;
        this.clock = clock;
    }

    // ================================================================== avançar / rejeitar

    @Transactional
    public Views.RequestView changeStatus(CurrentUser actor, UUID requestId, Inputs.ChangeStatus in) {
        RentalRequest r = requests.lockById(requestId).orElseThrow(ApiException::notFound);
        RequestStatus from = r.getStatus();
        RequestStatus to = in.status();
        if (!RequestStateMachine.canTransition(r.getType(), from, to)) {
            throw new ApiException(ErrorCode.INVALID_TRANSITION,
                    "Não é possível mudar de \"" + from.code() + "\" para \"" + to.code() + "\".");
        }
        String notes = TextSanitizer.line(in.notes(), 1000);
        LocalDate today = LocalDate.now(clock);

        if (to != RequestStatus.REJEITADA) {
            switch (r.getType()) {
                case ALUGUEL -> {
                    if (to == RequestStatus.EM_ENTREGA) {
                        if (r.getDumpster() == null) {
                            Dumpster d = reserve(r, null);
                            notes = join(notes, "Caçamba " + d.label() + " alocada automaticamente.");
                        } else {
                            ensureAvailableFor(r, lock(r.getDumpster().getId()));
                        }
                    } else if (to == RequestStatus.ENTREGUE) {
                        deliver(r, today);
                    }
                }
                case RETIRADA -> {
                    if (to == RequestStatus.FINALIZADA) {
                        boolean maintenance = Boolean.TRUE.equals(in.sendToMaintenance());
                        finishRemoval(r, actor, today, maintenance);
                        if (maintenance) {
                            notes = join(notes, "Caçamba enviada para manutenção.");
                        }
                    }
                }
                case TROCA -> {
                    // troca_solicitada → em_troca não altera caçambas; a troca efetiva é no complete-swap.
                }
            }
        }

        r.setStatus(to);
        requests.flush();
        audit.requestEvent(r, from, to, actor.userId(), notes);
        notifyCustomer(r, to);
        return Mappers.request(r);
    }

    // ================================================================== alocação

    @Transactional
    public Views.RequestView allocate(CurrentUser actor, UUID requestId, Inputs.Allocate in) {
        RentalRequest r = requests.lockById(requestId).orElseThrow(ApiException::notFound);
        if (!RequestStateMachine.canAllocate(r.getType(), r.getStatus())) {
            throw new ApiException(ErrorCode.INVALID_TRANSITION,
                    "Só é possível alocar caçamba em aluguel pendente ou aprovado.");
        }
        UUID previous = r.getDumpster() == null ? null : r.getDumpster().getId();
        Dumpster d = reserve(r, in.dumpsterId());
        String notes = join(TextSanitizer.line(in.notes(), 1000), "Caçamba " + d.label() + " alocada.");
        audit.requestEvent(r, r.getStatus(), r.getStatus(), actor.userId(), notes);
        audit.log(actor.userId(), "rental_request", r.getId(), "request.allocate",
                previous == null ? null : Map.of("dumpsterId", previous), Map.of("dumpsterId", d.getId()));
        return Mappers.request(r);
    }

    // ================================================================== troca

    @Transactional
    public Views.RequestView completeSwap(CurrentUser actor, UUID requestId, Inputs.CompleteSwap in) {
        RentalRequest r = requests.lockById(requestId).orElseThrow(ApiException::notFound);
        if (!RequestStateMachine.canCompleteSwap(r.getType(), r.getStatus())) {
            throw new ApiException(ErrorCode.INVALID_TRANSITION, "Esta solicitação não é uma troca em aberto.");
        }
        Customer customer = r.getCustomer();
        UUID oldId = r.getDumpster().getId();
        UUID replacementId = in.replacementDumpsterId();
        if (oldId.equals(replacementId)) {
            throw ApiException.field("replacementDumpsterId", "Escolha uma caçamba diferente da atual.");
        }

        // Ordem de travamento determinística evita deadlock entre trocas concorrentes.
        Dumpster old;
        Dumpster replacement;
        if (replacementId == null) {
            old = lock(oldId);
            replacement = dumpsters.lockFirstAvailable()
                    .orElseThrow(() -> new ApiException(ErrorCode.DUMPSTER_UNAVAILABLE, "Não há caçambas livres."));
        } else if (oldId.compareTo(replacementId) < 0) {
            old = lock(oldId);
            replacement = lock(replacementId);
        } else {
            replacement = lock(replacementId);
            old = lock(oldId);
        }

        if (old.getStatus() != DumpsterStatus.OCUPADA || old.getCustomer() == null
                || !old.getCustomer().getId().equals(customer.getId())) {
            throw ApiException.conflict("A caçamba atual não está mais com este cliente.");
        }
        ensureAvailableFor(null, replacement);

        LocalDate today = LocalDate.now(clock);
        RequestStatus from = r.getStatus();

        // 1) encerra a locação da caçamba antiga e finaliza as solicitações que a mantinham "em uso"
        rentals.lockActiveByDumpster(old.getId()).ifPresent(rental -> rental.end(today));
        finalizeInUse(old.getId(), actor, "Encerrada pela troca " + r.getProtocol() + ".");

        // 2) libera a antiga e ocupa a substituta no mesmo endereço (regra 6)
        boolean maintenance = Boolean.TRUE.equals(in.sendOldToMaintenance());
        old.release(maintenance ? DumpsterStatus.MANUTENCAO : DumpsterStatus.LIVRE);
        replacement.occupy(customer, r.getLocation(), today);
        rentals.save(new Rental(customer, replacement, r.getLocation(), r.getId(), today, r.getPriceCents(),
                RentalOperation.TROCA));

        r.setReplacementDumpster(replacement);
        r.setStatus(RequestStatus.EM_USO);
        requests.flush();

        String notes = join(TextSanitizer.line(in.notes(), 1000),
                "Troca " + old.label() + " → " + replacement.label() + (maintenance ? " (antiga em manutenção)." : "."));
        audit.requestEvent(r, from, RequestStatus.EM_USO, actor.userId(), notes);
        audit.log(actor.userId(), "dumpster", old.getId(), "dumpster.release",
                Map.of("status", DumpsterStatus.OCUPADA.code()), Map.of("status", old.getStatus().code()));
        audit.log(actor.userId(), "dumpster", replacement.getId(), "dumpster.occupy",
                Map.of("status", DumpsterStatus.LIVRE.code()), Map.of("status", DumpsterStatus.OCUPADA.code(),
                        "customerId", customer.getId()));
        notifications.notifyUser(customer.getUserId(), "Troca concluída",
                "Sua nova caçamba é a " + replacement.label() + ".", r.getId());
        return Mappers.request(r);
    }

    // ================================================================== apoio

    /** Reserva (aloca) uma caçamba para o aluguel: escolhida ou a primeira livre. */
    private Dumpster reserve(RentalRequest r, UUID dumpsterId) {
        Dumpster d;
        if (dumpsterId != null) {
            d = dumpsters.lockById(dumpsterId)
                    .orElseThrow(() -> ApiException.field("dumpsterId", "Caçamba não encontrada."));
            ensureAvailableFor(r, d);
        } else {
            d = dumpsters.lockFirstAvailable()
                    .orElseThrow(() -> new ApiException(ErrorCode.DUMPSTER_UNAVAILABLE, "Não há caçambas livres."));
        }
        r.setDumpster(d);
        requests.flush(); // índice ux_requests_dumpster_reserved valida aqui (→ 409)
        return d;
    }

    /** Livre e sem reserva de outra solicitação. */
    private void ensureAvailableFor(RentalRequest r, Dumpster d) {
        UUID exclude = r == null ? RentalRequestRepository.NO_ID : r.getId();
        if (d.getStatus() != DumpsterStatus.LIVRE || requests.isReserved(d.getId(), exclude)) {
            throw new ApiException(ErrorCode.DUMPSTER_UNAVAILABLE,
                    "A caçamba " + d.label() + " não está disponível.");
        }
    }

    /** em_entrega → entregue: caçamba passa a "ocupada" e a locação começa. */
    private void deliver(RentalRequest r, LocalDate today) {
        if (r.getDumpster() == null) {
            throw ApiException.rule("Aloque uma caçamba antes de concluir a entrega.");
        }
        Dumpster d = lock(r.getDumpster().getId());
        if (d.getStatus() != DumpsterStatus.LIVRE) {
            throw new ApiException(ErrorCode.DUMPSTER_UNAVAILABLE,
                    "A caçamba reservada não está disponível. Realoque a solicitação.");
        }
        d.occupy(r.getCustomer(), r.getLocation(), today);
        rentals.save(new Rental(r.getCustomer(), d, r.getLocation(), r.getId(), today, r.getPriceCents(),
                RentalOperation.LOCACAO));
    }

    /** em_retirada → finalizada: encerra locação e libera a caçamba (regra 7). */
    private void finishRemoval(RentalRequest r, CurrentUser actor, LocalDate today, boolean maintenance) {
        Dumpster d = lock(r.getDumpster().getId());
        rentals.lockActiveByDumpster(d.getId()).ifPresent(rental -> rental.end(today));
        finalizeInUse(d.getId(), actor, "Encerrada pela retirada " + r.getProtocol() + ".");
        DumpsterStatus before = d.getStatus();
        d.release(maintenance ? DumpsterStatus.MANUTENCAO : DumpsterStatus.LIVRE);
        audit.log(actor.userId(), "dumpster", d.getId(), "dumpster.release",
                Map.of("status", before.code()), Map.of("status", d.getStatus().code()));
    }

    private void finalizeInUse(UUID dumpsterId, CurrentUser actor, String notes) {
        for (RentalRequest inUse : requests.findInUseByCurrentDumpster(dumpsterId)) {
            inUse.setStatus(RequestStatus.FINALIZADA);
            audit.requestEvent(inUse, RequestStatus.EM_USO, RequestStatus.FINALIZADA, actor.userId(), notes);
        }
    }

    private Dumpster lock(UUID id) {
        return dumpsters.lockById(id).orElseThrow(ApiException::notFound);
    }

    private void notifyCustomer(RentalRequest r, RequestStatus to) {
        String description = StatusMessages.typeLabel(r.getType()) + " " + r.getProtocol()
                + (r.currentDumpster() != null ? " · caçamba " + r.currentDumpster().label() : "");
        notifications.notifyUser(r.getCustomer().getUserId(), StatusMessages.title(to), description, r.getId());
    }

    private static String join(String a, String b) {
        if (a == null || a.isBlank()) {
            return b;
        }
        return a + " " + b;
    }
}
