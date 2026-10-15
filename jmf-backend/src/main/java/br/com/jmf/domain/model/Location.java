package br.com.jmf.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "locations")
public class Location extends AuditedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "owner_customer_id", updatable = false)
    private UUID ownerCustomerId;

    @Column(name = "postal_code", nullable = false)
    private String postalCode;

    @Column(nullable = false)
    private String street;

    @Column(nullable = false)
    private String number;

    @Column(nullable = false)
    private String neighborhood;

    private String complement;

    @Column(nullable = false)
    private String city;

    @Column(nullable = false, columnDefinition = "char(2)")
    private String state;

    @Column(nullable = false, precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(nullable = false, precision = 9, scale = 6)
    private BigDecimal longitude;

    @Column(nullable = false)
    private String label;

    @Column(nullable = false)
    private LocationSource source = LocationSource.ENDERECO;

    protected Location() {
    }

    public Location(UUID ownerCustomerId, String postalCode, String street, String number, String neighborhood,
                    String complement, String city, String state, BigDecimal latitude, BigDecimal longitude,
                    String label, LocationSource source) {
        this.ownerCustomerId = ownerCustomerId;
        this.postalCode = postalCode;
        this.street = street;
        this.number = number;
        this.neighborhood = neighborhood;
        this.complement = complement;
        this.city = city;
        this.state = state;
        this.latitude = latitude;
        this.longitude = longitude;
        this.label = label;
        this.source = source;
    }

    public UUID getId() {
        return id;
    }

    public UUID getOwnerCustomerId() {
        return ownerCustomerId;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public String getStreet() {
        return street;
    }

    public String getNumber() {
        return number;
    }

    public String getNeighborhood() {
        return neighborhood;
    }

    public String getComplement() {
        return complement;
    }

    public String getCity() {
        return city;
    }

    public String getState() {
        return state;
    }

    public BigDecimal getLatitude() {
        return latitude;
    }

    public BigDecimal getLongitude() {
        return longitude;
    }

    public String getLabel() {
        return label;
    }

    public LocationSource getSource() {
        return source;
    }
}
