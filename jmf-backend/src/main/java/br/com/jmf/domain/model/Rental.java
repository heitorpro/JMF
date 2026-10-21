package br.com.jmf.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "rentals")
public class Rental extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false, updatable = false)
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "dumpster_id", nullable = false, updatable = false)
    private Dumpster dumpster;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "location_id", nullable = false, updatable = false)
    private Location location;

    @Column(name = "request_id", updatable = false)
    private UUID requestId;

    @Column(name = "started_at", nullable = false)
    private LocalDate startedAt;

    @Column(name = "ended_at")
    private LocalDate endedAt;

    @Column(name = "weekly_price_cents", nullable = false)
    private long weeklyPriceCents;

    @Column(name = "period_days", nullable = false)
    private int periodDays = 7;

    @Column(nullable = false)
    private RentalStatus status = RentalStatus.ATIVO;

    @Column(nullable = false, updatable = false)
    private RentalOperation operation;

    protected Rental() {
    }

    public Rental(Customer customer, Dumpster dumpster, Location location, UUID requestId, LocalDate startedAt,
                  long weeklyPriceCents, RentalOperation operation) {
        this.customer = customer;
        this.dumpster = dumpster;
        this.location = location;
        this.requestId = requestId;
        this.startedAt = startedAt;
        this.weeklyPriceCents = weeklyPriceCents;
        this.operation = operation;
    }

    public void end(LocalDate date) {
        this.status = RentalStatus.ENCERRADO;
        this.endedAt = date;
    }

    public UUID getId() {
        return id;
    }

    public Customer getCustomer() {
        return customer;
    }

    public Dumpster getDumpster() {
        return dumpster;
    }

    public Location getLocation() {
        return location;
    }

    public UUID getRequestId() {
        return requestId;
    }

    public LocalDate getStartedAt() {
        return startedAt;
    }

    public LocalDate getEndedAt() {
        return endedAt;
    }

    public long getWeeklyPriceCents() {
        return weeklyPriceCents;
    }

    public int getPeriodDays() {
        return periodDays;
    }

    public void setPeriodDays(int periodDays) {
        this.periodDays = periodDays;
    }

    /** Fim previsto do período contratado. */
    public LocalDate endsAt() {
        return startedAt.plusDays(periodDays);
    }

    public RentalStatus getStatus() {
        return status;
    }

    public RentalOperation getOperation() {
        return operation;
    }
}
