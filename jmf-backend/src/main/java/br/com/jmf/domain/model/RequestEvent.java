package br.com.jmf.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Immutable;

import java.time.Instant;
import java.util.UUID;

/** Histórico imutável (o banco também bloqueia UPDATE/DELETE via trigger). */
@Entity
@Immutable
@Table(name = "request_events")
public class RequestEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "request_id", nullable = false)
    private UUID requestId;

    @Column(name = "from_status")
    private RequestStatus fromStatus;

    @Column(name = "to_status", nullable = false)
    private RequestStatus toStatus;

    @Column(name = "actor_user_id", nullable = false)
    private UUID actorUserId;

    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected RequestEvent() {
    }

    public RequestEvent(UUID requestId, RequestStatus fromStatus, RequestStatus toStatus, UUID actorUserId,
                        String notes) {
        this.requestId = requestId;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.actorUserId = actorUserId;
        this.notes = notes;
    }

    public UUID getId() {
        return id;
    }

    public UUID getRequestId() {
        return requestId;
    }

    public RequestStatus getFromStatus() {
        return fromStatus;
    }

    public RequestStatus getToStatus() {
        return toStatus;
    }

    public UUID getActorUserId() {
        return actorUserId;
    }

    public String getNotes() {
        return notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
