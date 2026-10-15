package br.com.jmf.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** Linha única (id = 1). */
@Entity
@Table(name = "company_settings")
public class CompanySettings {

    public static final short SINGLETON_ID = 1;

    @Id
    private Short id = SINGLETON_ID;

    @Column(name = "weekly_price_cents", nullable = false)
    private long weeklyPriceCents;

    @Column(name = "period_days", nullable = false)
    private int periodDays;

    private String whatsapp;

    private String email;

    private String phone;

    private String address;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected CompanySettings() {
    }

    public Short getId() {
        return id;
    }

    public long getWeeklyPriceCents() {
        return weeklyPriceCents;
    }

    public void setWeeklyPriceCents(long weeklyPriceCents) {
        this.weeklyPriceCents = weeklyPriceCents;
    }

    public int getPeriodDays() {
        return periodDays;
    }

    public void setPeriodDays(int periodDays) {
        this.periodDays = periodDays;
    }

    public String getWhatsapp() {
        return whatsapp;
    }

    public void setWhatsapp(String whatsapp) {
        this.whatsapp = whatsapp;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public UUID getUpdatedBy() {
        return updatedBy;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void touch(UUID userId, Instant when) {
        this.updatedBy = userId;
        this.updatedAt = when;
    }
}
