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
            /** Plano contratado: 7, 15 ou 30 dias. */
            int periodDays,
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
            LocalDate startedAt, LocalDate endedAt, LocationView location,
            /** Valor do período contratado (nome mantido por compatibilidade). */
            long weeklyPriceCents,
            int periodDays,
            /** Fim previsto do período: início + periodDays. */
            LocalDate endsAt,
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

    public record SettingsView(long weeklyPriceCents, int periodDays, long price15Cents, long price30Cents,
                               List<PlanView> plans, String whatsapp, String email, String phone,
                               String address, Instant updatedAt) {
    }

    /** Plano de aluguel disponível ao cliente. */
    public record PlanView(int days, long priceCents) {
    }

    public record PricingView(long weeklyPriceCents, int periodDays, List<PlanView> plans) {
    }

    public record ClientDashboardView(
            CustomerProfileView customer, List<RentalView> activeRentals, List<RequestView> openRequests,
            long totalRentals, long unreadNotifications, PricingView pricing, SettingsContactView contact,
            /** Caçambas livres e sem reserva no momento. */
            long availableDumpsters) {
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

    // ------------------------------------------------------------------ resumo financeiro

    /** Um mês do histórico: locações iniciadas, faturamento e ocupação média da frota (%). */
    public record FinanceMonthView(String month, long rentals, long swaps, long revenueCents, long customers,
                                   double occupancyPct) {
    }

    /** Totais de locações iniciadas entre from e to (inclusive). */
    public record FinancePeriodView(LocalDate from, LocalDate to, long rentals, long swaps, long revenueCents) {
    }

    /** Locação ativa que venceu (daysLate > 0) ou vence em breve (daysLate <= 0). */
    public record FinanceDueView(UUID rentalId, String customerName, int dumpsterNumber, String neighborhood,
                                 LocalDate startedAt, LocalDate endsAt, long daysLate) {
    }

    public record FinanceNeighborhoodView(String neighborhood, long rentals, long revenueCents) {
    }

    /** Período escolhido no painel: totais, comparação com o período anterior equivalente e meses. */
    public record FinancePeriodDetailView(
            LocalDate from, LocalDate to,
            /** Fim pedido (to pode ser menor quando o período ainda está em andamento). */
            LocalDate requestedTo, boolean partial,
            long rentals, long swaps, long revenueCents, long customers, long removals, double occupancyPct,
            FinancePeriodView previous, List<FinanceMonthView> months,
            List<FinanceNeighborhoodView> topNeighborhoods) {
    }

    public record FinanceView(
            LocalDate today, int fleetSize,
            /** Últimos 12 meses, do mais antigo ao atual (o atual é parcial, até hoje). */
            List<FinanceMonthView> months,
            FinancePeriodView monthToDate, FinancePeriodView previousMonthSamePeriod,
            FinancePeriodView previousMonth, FinancePeriodView yearToDate,
            long activeRentals, long activeValueCents,
            List<FinanceDueView> overdue, List<FinanceDueView> dueSoon) {
    }
}
