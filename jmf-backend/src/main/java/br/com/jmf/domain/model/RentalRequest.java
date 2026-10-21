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
import jakarta.persistence.Version;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "rental_requests")
public class RentalRequest extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, updatable = false)
    private String protocol;

    @Column(nullable = false, updatable = false)
    private RequestType type;

    @Column(nullable = false)
    private RequestStatus status;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false, updatable = false)
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dumpster_id")
    private Dumpster dumpster;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "replacement_dumpster_id")
    private Dumpster replacementDumpster;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "location_id", nullable = false)
    private Location location;

    @Column(name = "desired_date", nullable = false)
    private LocalDate desiredDate;

    @Column(name = "price_cents", nullable = false)
    private long priceCents;

    @Column(name = "period_days", nullable = false)
    private int periodDays = 7;

    private String reason;

    private String details;

    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attachment_id")
    private Attachment attachment;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Version
    private long version;

    protected RentalRequest() {
    }

    public RentalRequest(String protocol, RequestType type, RequestStatus status, Customer customer,
                         Location location, LocalDate desiredDate, long priceCents, UUID createdBy) {
        this.protocol = protocol;
        this.type = type;
        this.status = status;
        this.customer = customer;
        this.location = location;
        this.desiredDate = desiredDate;
        this.priceCents = priceCents;
        this.createdBy = createdBy;
    }

    public UUID getId() {
        return id;
    }

    public String getProtocol() {
        return protocol;
    }

    public RequestType getType() {
        return type;
    }

    public RequestStatus getStatus() {
        return status;
    }

    public void setStatus(RequestStatus status) {
        this.status = status;
    }

    public Customer getCustomer() {
        return customer;
    }

    public Dumpster getDumpster() {
        return dumpster;
    }

    public void setDumpster(Dumpster dumpster) {
        this.dumpster = dumpster;
    }

    public Dumpster getReplacementDumpster() {
        return replacementDumpster;
    }

    public void setReplacementDumpster(Dumpster replacementDumpster) {
        this.replacementDumpster = replacementDumpster;
    }

    public Location getLocation() {
        return location;
    }

    public LocalDate getDesiredDate() {
        return desiredDate;
    }

    public long getPriceCents() {
        return priceCents;
    }

    public int getPeriodDays() {
        return periodDays;
    }

    public void setPeriodDays(int periodDays) {
        this.periodDays = periodDays;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Attachment getAttachment() {
        return attachment;
    }

    public void setAttachment(Attachment attachment) {
        this.attachment = attachment;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    /** Caçamba atualmente com o cliente por causa desta solicitação (substituta, se houve troca). */
    public Dumpster currentDumpster() {
        return replacementDumpster != null ? replacementDumpster : dumpster;
    }
}
