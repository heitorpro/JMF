package br.com.jmf.web.dto;

import br.com.jmf.domain.model.Audience;
import br.com.jmf.domain.model.CustomerStatus;
import br.com.jmf.domain.model.DumpsterStatus;
import br.com.jmf.domain.model.LocationSource;
import br.com.jmf.domain.model.Permission;
import br.com.jmf.domain.model.RentalOperation;
import br.com.jmf.domain.model.RentalStatus;
import br.com.jmf.domain.model.RequestStatus;
import br.com.jmf.domain.model.RequestType;
import br.com.jmf.domain.model.Role;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Respostas da API. Valores monetários em centavos (sufixo "Cents"). */
public final class Views {

    private Views() {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LocationView(
            UUID id, String postalCode, String street, String number, String neighborhood, String complement,
            String city, String state, BigDecimal latitude, BigDecimal longitude, String label,
            LocationSource source,
            /** Link gerado no servidor a partir das coordenadas persistidas (regra 11). */
            String mapsUrl) {
    }

    public record AttachmentView(UUID id, String name, String contentType, long sizeBytes) {
    }

    public record RequestView(
            UUID id, String protocol, RequestType type, RequestStatus status,
            UUID customerId, String customerName,
            UUID dumpsterId, Integer dumpsterNumber,
            UUID replacementDumpsterId, Integer replacementDumpsterNumber,
            LocalDate desiredDate, LocationView location, long priceCents,
            String reason, String details, String notes, AttachmentView attachment,
            /** Próximo status no fluxo (para o botão "Avançar" do gestor); null se não houver. */
            RequestStatus nextStatus,
            boolean cancellable,
            Instant createdAt, Instant updatedAt) {
    }

    public record RequestEventView(RequestStatus fromStatus, RequestStatus toStatus, String notes, Instant createdAt) {
    }

    public record RequestDetailView(RequestView request, List<RequestEventView> events) {
    }

    public record DumpsterView(
            UUID id, int number, String label, DumpsterStatus status,
            UUID customerId, String customerName, LocationView location, LocalDate rentalStartedAt,
            String notes, boolean reserved, Instant updatedAt) {
    }

    public record RentalView(
            UUID id, UUID customerId, String customerName, UUID dumpsterId, Integer dumpsterNumber,
            LocalDate startedAt, LocalDate endedAt, LocationView location, long weeklyPriceCents,
            RentalStatus status, RentalOperation operation) {
    }

    public record CustomerView(
            UUID id, String name, String initials, String cpfMasked, String phone, String email,
            CustomerStatus status, long totalRentals, List<Integer> currentDumpsterNumbers, Instant createdAt) {
    }

    public record UserView(UUID id, String name, String email, String phone, Role role, Set<Permission> permissions) {
    }

    public record CustomerProfileView(UUID id, String name, String cpfMasked, String phone, String email,
                                      CustomerStatus status) {
    }

    public record MeView(UserView user, CustomerProfileView customer, boolean profileComplete) {
    }

    public record NotificationView(UUID id, String title, String description, Audience audience, UUID requestId,
                                   boolean read, Instant readAt, Instant createdAt) {
    }

    public record SettingsView(long weeklyPriceCents, int periodDays, String whatsapp, String email, String phone,
                               String address, Instant updatedAt) {
    }

    public record PricingView(long weeklyPriceCents, int periodDays) {
    }

    public record ClientDashboardView(
            CustomerProfileView customer, List<RentalView> activeRentals, List<RequestView> openRequests,
            long totalRentals, long unreadNotifications, PricingView pricing, SettingsContactView contact) {
    }

    public record SettingsContactView(String whatsapp, String email, String phone, String address) {
    }

    public record ActivityView(UUID id, UUID requestId, String protocol, RequestType requestType, String customerName,
                               RequestStatus fromStatus, RequestStatus toStatus, String title, String notes,
                               Instant createdAt) {
    }

    public record OverviewView(
            /** Chaves: livre, ocupada, manutencao, indisponivel. */
            Map<String, Long> dumpstersByStatus, long totalDumpsters, long availableDumpsters,
            long pendingRequests, long activeRentals, long activeCustomers, long weeklyRevenueCents,
            List<ActivityView> recentActivity) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record MapPointView(
            String id, String kind, String status, UUID dumpsterId, Integer dumpsterNumber, String customerName,
            UUID requestId, String protocol, RequestType requestType, LocalDate rentalStartedAt,
            LocationView location) {
    }

    public record ResolvedLocationView(LocationView location, boolean geocoded) {
    }
}
