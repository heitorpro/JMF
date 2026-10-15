package br.com.jmf.service;

import br.com.jmf.common.ApiException;
import br.com.jmf.common.PageParams;
import br.com.jmf.common.PageResponse;
import br.com.jmf.domain.model.Customer;
import br.com.jmf.domain.model.CustomerStatus;
import br.com.jmf.domain.model.Dumpster;
import br.com.jmf.domain.model.DumpsterStatus;
import br.com.jmf.domain.model.Rental;
import br.com.jmf.domain.model.RentalRequest;
import br.com.jmf.domain.model.RentalStatus;
import br.com.jmf.domain.model.RequestEvent;
import br.com.jmf.domain.model.RequestStatus;
import br.com.jmf.domain.model.RequestType;
import br.com.jmf.domain.repository.CustomerRepository;
import br.com.jmf.domain.repository.DumpsterRepository;
import br.com.jmf.domain.repository.RentalRepository;
import br.com.jmf.domain.repository.RentalRequestRepository;
import br.com.jmf.domain.repository.RequestEventRepository;
import br.com.jmf.web.dto.Views;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Consultas da área do gestor (somente leitura). */
@Service
@Transactional(readOnly = true)
public class ManagerQueryService {

    private static final int MAP_LIMIT = 500;
    private static final ZoneId ZONE = br.com.jmf.config.WebConfig.ZONE;

    private final RentalRequestRepository requests;
    private final RequestEventRepository events;
    private final DumpsterRepository dumpsters;
    private final RentalRepository rentals;
    private final CustomerRepository customers;

    public ManagerQueryService(RentalRequestRepository requests, RequestEventRepository events,
                               DumpsterRepository dumpsters, RentalRepository rentals, CustomerRepository customers) {
        this.requests = requests;
        this.events = events;
        this.dumpsters = dumpsters;
        this.rentals = rentals;
        this.customers = customers;
    }

    // ================================================================== solicitações

    public record RequestFilter(List<RequestStatus> status, RequestType type, UUID customerId, String q,
                                LocalDate from, LocalDate to, Boolean awaitingAction) {
    }

    public PageResponse<Views.RequestView> requests(RequestFilter f, Integer page, Integer size) {
        Specification<RentalRequest> spec = (root, q, cb) -> cb.conjunction();
        if (f.status() != null && !f.status().isEmpty()) {
            spec = spec.and((root, q, cb) -> root.get("status").in(f.status()));
        }
        if (Boolean.TRUE.equals(f.awaitingAction())) {
            spec = spec.and((root, q, cb) -> root.get("status").in(RequestStateMachine.AWAITING_MANAGER));
        }
        if (f.type() != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("type"), f.type()));
        }
        if (f.customerId() != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("customer").get("id"), f.customerId()));
        }
        String term = Queries.likeTerm(f.q());
        if (term != null) {
            spec = spec.and((root, q, cb) -> cb.or(
                    cb.like(cb.lower(root.<String>get("protocol")), term, '\\'),
                    cb.like(cb.lower(root.get("customer").<String>get("name")), term, '\\')));
        }
        if (f.from() != null) {
            spec = spec.and((root, q, cb) -> cb.greaterThanOrEqualTo(root.<Instant>get("createdAt"),
                    f.from().atStartOfDay(ZONE).toInstant()));
        }
        if (f.to() != null) {
            spec = spec.and((root, q, cb) -> cb.lessThan(root.<Instant>get("createdAt"),
                    f.to().plusDays(1).atStartOfDay(ZONE).toInstant()));
        }
        Page<RentalRequest> result = requests.findAll(spec,
                PageParams.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.of(result, Mappers::request);
    }

    public Views.RequestDetailView request(UUID id) {
        RentalRequest r = requests.findDetailedById(id).orElseThrow(ApiException::notFound);
        return new Views.RequestDetailView(Mappers.request(r),
                events.findByRequestIdOrderByCreatedAtAsc(id).stream().map(Mappers::event).toList());
    }

    // ================================================================== clientes

    public PageResponse<Views.CustomerView> customers(String q, CustomerStatus status, Integer page, Integer size) {
        Specification<Customer> spec = (root, query, cb) -> cb.conjunction();
        String term = Queries.likeTerm(q);
        if (term != null) {
            String digits = q.replaceAll("\\D", "");
            spec = spec.and((root, query, cb) -> {
                var byName = cb.like(cb.lower(root.<String>get("name")), term, '\\');
                var byEmail = cb.like(cb.lower(root.<String>get("email")), term, '\\');
                if (digits.length() >= 4) {
                    return cb.or(byName, byEmail, cb.like(root.<String>get("phone"), "%" + digits + "%"));
                }
                return cb.or(byName, byEmail);
            });
        }
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        Page<Customer> result = customers.findAll(spec, PageParams.of(page, size, Sort.by("name")));
        List<UUID> ids = result.getContent().stream().map(Customer::getId).toList();

        Map<UUID, Long> totals = new HashMap<>();
        Map<UUID, List<Integer>> current = new HashMap<>();
        if (!ids.isEmpty()) {
            for (Object[] row : customers.countRentalsByCustomer(ids)) {
                totals.put((UUID) row[0], ((Number) row[1]).longValue());
            }
            for (Object[] row : dumpsters.findNumbersByCustomer(ids)) {
                current.computeIfAbsent((UUID) row[0], k -> new ArrayList<>()).add(((Number) row[1]).intValue());
            }
        }
        return PageResponse.of(result, c -> Mappers.customer(c, totals.getOrDefault(c.getId(), 0L),
                current.getOrDefault(c.getId(), List.of())));
    }

    // ================================================================== locações

    public PageResponse<Views.RentalView> rentals(RentalStatus status, UUID customerId, Integer dumpsterNumber,
                                                  Integer page, Integer size) {
        Specification<Rental> spec = (root, q, cb) -> cb.conjunction();
        if (status != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), status));
        }
        if (customerId != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("customer").get("id"), customerId));
        }
        if (dumpsterNumber != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("dumpster").get("number"), dumpsterNumber));
        }
        return PageResponse.of(rentals.findAll(spec, PageParams.of(page, size,
                Sort.by(Sort.Direction.DESC, "startedAt"))), Mappers::rental);
    }

    // ================================================================== mapa

    /** Caçambas em campo + solicitações com logística pendente. Limite rígido de pontos. */
    public List<Views.MapPointView> map() {
        List<Views.MapPointView> points = new ArrayList<>();
        for (Dumpster d : dumpsters.findByStatusIn(EnumSet.of(DumpsterStatus.OCUPADA))) {
            if (d.getLocation() == null || points.size() >= MAP_LIMIT) {
                continue;
            }
            points.add(new Views.MapPointView("dumpster:" + d.getId(), "cacamba", d.getStatus().code(), d.getId(),
                    d.getNumber(), d.getCustomer() == null ? null : d.getCustomer().getName(), null, null, null,
                    d.getRentalStartedAt(), Mappers.location(d.getLocation())));
        }
        for (RentalRequest r : requests.findTop200ByStatusInOrderByCreatedAtDesc(RequestStateMachine.OPEN_LOGISTICS)) {
            if (points.size() >= MAP_LIMIT) {
                break;
            }
            Dumpster d = r.currentDumpster();
            points.add(new Views.MapPointView("request:" + r.getId(), "solicitacao", r.getStatus().code(),
                    d == null ? null : d.getId(), d == null ? null : d.getNumber(), r.getCustomer().getName(),
                    r.getId(), r.getProtocol(), r.getType(), null, Mappers.location(r.getLocation())));
        }
        return points;
    }

    // ================================================================== visão geral

    public Views.OverviewView overview() {
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (DumpsterStatus s : DumpsterStatus.values()) {
            byStatus.put(s.code(), 0L);
        }
        long total = 0;
        for (Object[] row : dumpsters.countByStatus()) {
            long count = ((Number) row[1]).longValue();
            byStatus.put(((DumpsterStatus) row[0]).code(), count);
            total += count;
        }
        long reservedFree = requests.findReservedDumpsterIds().size();
        long available = Math.max(0, byStatus.get(DumpsterStatus.LIVRE.code()) - reservedFree);

        List<RequestEvent> recent = events.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 10));
        Set<UUID> requestIds = recent.stream().map(RequestEvent::getRequestId).collect(Collectors.toSet());
        Map<UUID, RentalRequest> byId = requests.findAllById(requestIds).stream()
                .collect(Collectors.toMap(RentalRequest::getId, Function.identity()));
        List<Views.ActivityView> activity = recent.stream().map(e -> {
            RentalRequest r = byId.get(e.getRequestId());
            return new Views.ActivityView(e.getId(), e.getRequestId(), r == null ? null : r.getProtocol(),
                    r == null ? null : r.getType(), r == null ? null : r.getCustomer().getName(),
                    e.getFromStatus(), e.getToStatus(), StatusMessages.title(e.getToStatus()), e.getNotes(),
                    e.getCreatedAt());
        }).toList();

        return new Views.OverviewView(byStatus, total, available,
                requests.countByStatusIn(RequestStateMachine.AWAITING_MANAGER),
                rentals.countByStatus(RentalStatus.ATIVO),
                customers.countActive(),
                rentals.sumActiveWeeklyPriceCents(),
                activity);
    }
}
