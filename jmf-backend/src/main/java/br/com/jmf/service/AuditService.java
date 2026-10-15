package br.com.jmf.service;

import br.com.jmf.domain.model.AuditLog;
import br.com.jmf.domain.model.RentalRequest;
import br.com.jmf.domain.model.RequestEvent;
import br.com.jmf.domain.model.RequestStatus;
import br.com.jmf.domain.repository.AuditLogRepository;
import br.com.jmf.domain.repository.RequestEventRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/** Registros imutáveis de auditoria (regra 12). Sempre na mesma transação da alteração. */
@Service
public class AuditService {

    private final RequestEventRepository events;
    private final AuditLogRepository logs;
    private final ObjectMapper mapper;

    public AuditService(RequestEventRepository events, AuditLogRepository logs, ObjectMapper mapper) {
        this.events = events;
        this.logs = logs;
        this.mapper = mapper;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requestEvent(RentalRequest request, RequestStatus from, RequestStatus to, UUID actor, String notes) {
        events.save(new RequestEvent(request.getId(), from, to, actor, notes));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void log(UUID actor, String entityType, Object entityId, String action,
                    Map<String, ?> before, Map<String, ?> after) {
        logs.save(new AuditLog(actor, entityType, String.valueOf(entityId), action, json(before), json(after)));
    }

    private String json(Map<String, ?> data) {
        if (data == null) {
            return null;
        }
        try {
            return mapper.writeValueAsString(data);
        } catch (JsonProcessingException e) {
            return null;
        }
    }
}
