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
@Table(name = "dumpsters")
public class Dumpster extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private int number;

    @Column(nullable = false)
    private DumpsterStatus status = DumpsterStatus.LIVRE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id")
    private Location location;

    @Column(name = "rental_started_at")
    private LocalDate rentalStartedAt;

    private String notes;

    @Version
    private long version;

    protected Dumpster() {
    }

    public Dumpster(int number, DumpsterStatus status, String notes) {
        this.number = number;
        this.status = status;
        this.notes = notes;
    }

    /** Entrega ao cliente: passa a "ocupada" no endereço da solicitação. */
    public void occupy(Customer customer, Location location, LocalDate startedAt) {
        this.status = DumpsterStatus.OCUPADA;
        this.customer = customer;
        this.location = location;
        this.rentalStartedAt = startedAt;
    }

    /** Recolhimento: volta para "livre" (ou manutenção) e perde vínculo com o cliente. */
    public void release(DumpsterStatus newStatus) {
        if (newStatus == DumpsterStatus.OCUPADA) {
            throw new IllegalArgumentException("release não pode ocupar a caçamba");
        }
        this.status = newStatus;
        this.customer = null;
        this.location = null;
        this.rentalStartedAt = null;
    }

    public UUID getId() {
        return id;
    }

    public int getNumber() {
        return number;
    }

    public DumpsterStatus getStatus() {
        return status;
    }

    public void setStatus(DumpsterStatus status) {
        this.status = status;
    }

    public Customer getCustomer() {
        return customer;
    }

    public Location getLocation() {
        return location;
    }

    public LocalDate getRentalStartedAt() {
        return rentalStartedAt;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public long getVersion() {
        return version;
    }

    /** "#003" — mesmo formato do frontend. */
    public String label() {
        return "#" + String.format("%03d", number);
    }
}
