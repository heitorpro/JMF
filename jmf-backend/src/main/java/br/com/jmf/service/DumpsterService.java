package br.com.jmf.service;

import br.com.jmf.common.ApiException;
import br.com.jmf.common.PageParams;
import br.com.jmf.common.PageResponse;
import br.com.jmf.common.TextSanitizer;
import br.com.jmf.domain.model.Dumpster;
import br.com.jmf.domain.model.DumpsterStatus;
import br.com.jmf.domain.repository.DumpsterRepository;
import br.com.jmf.domain.repository.RentalRequestRepository;
import br.com.jmf.security.CurrentUser;
import br.com.jmf.web.dto.Inputs;
import br.com.jmf.web.dto.Views;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class DumpsterService {

    private final DumpsterRepository dumpsters;
    private final RentalRequestRepository requests;
    private final AuditService audit;

    public DumpsterService(DumpsterRepository dumpsters, RentalRequestRepository requests, AuditService audit) {
        this.dumpsters = dumpsters;
        this.requests = requests;
        this.audit = audit;
    }

    /**
     * @param available true = somente livres e sem reserva (para o seletor de alocação/troca)
     */
    @Transactional(readOnly = true)
    public PageResponse<Views.DumpsterView> list(DumpsterStatus status, Integer number, String customer,
                                                 Boolean available, Integer page, Integer size) {
        Set<UUID> reserved = new HashSet<>(requests.findReservedDumpsterIds());
        Specification<Dumpster> spec = (root, q, cb) -> cb.conjunction();
        if (status != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), status));
        }
        if (number != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("number"), number));
        }
        String term = Queries.likeTerm(customer);
        if (term != null) {
            spec = spec.and((root, q, cb) -> cb.like(cb.lower(root.join("customer").<String>get("name")), term, '\\'));
        }
        if (Boolean.TRUE.equals(available)) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), DumpsterStatus.LIVRE));
            if (!reserved.isEmpty()) {
                spec = spec.and((root, q, cb) -> cb.not(root.get("id").in(reserved)));
            }
        }
        Page<Dumpster> result = dumpsters.findAll(spec, PageParams.of(page, size, Sort.by("number")));
        return PageResponse.of(result, d -> Mappers.dumpster(d, reserved.contains(d.getId())));
    }

    @Transactional
    public Views.DumpsterView create(CurrentUser actor, Inputs.CreateDumpster in) {
        DumpsterStatus status = in.status() == null ? DumpsterStatus.LIVRE : in.status();
        if (status == DumpsterStatus.OCUPADA) {
            throw ApiException.field("status", "Uma caçamba nova não pode ser cadastrada como ocupada.");
        }
        if (dumpsters.existsByNumber(in.number())) {
            throw ApiException.conflict("Já existe uma caçamba com este número.");
        }
        Dumpster d = dumpsters.saveAndFlush(new Dumpster(in.number(), status, TextSanitizer.line(in.notes(), 500)));
        audit.log(actor.userId(), "dumpster", d.getId(), "dumpster.create", null, snapshot(d));
        return Mappers.dumpster(d, false);
    }

    @Transactional
    public Views.DumpsterView update(CurrentUser actor, UUID id, Inputs.UpdateDumpster in) {
        Dumpster d = dumpsters.lockById(id).orElseThrow(ApiException::notFound);
        Map<String, Object> before = snapshot(d);
        boolean reserved = requests.isReserved(d.getId(), RentalRequestRepository.NO_ID);

        if (in.status() != null && in.status() != d.getStatus()) {
            if (d.getStatus() == DumpsterStatus.OCUPADA || in.status() == DumpsterStatus.OCUPADA) {
                throw ApiException.rule("Caçamba ocupada só muda de status por entrega, troca ou retirada.");
            }
            if (reserved) {
                throw ApiException.conflict("A caçamba está reservada para uma entrega. Realoque a solicitação antes.");
            }
            d.setStatus(in.status());
        }
        if (in.notes() != null) {
            d.setNotes(TextSanitizer.line(in.notes(), 500));
        }
        dumpsters.flush();
        audit.log(actor.userId(), "dumpster", d.getId(), "dumpster.update", before, snapshot(d));
        return Mappers.dumpster(d, reserved);
    }

    private static Map<String, Object> snapshot(Dumpster d) {
        Map<String, Object> m = new HashMap<>();
        m.put("number", d.getNumber());
        m.put("status", d.getStatus().code());
        m.put("notes", d.getNotes());
        return m;
    }
}
