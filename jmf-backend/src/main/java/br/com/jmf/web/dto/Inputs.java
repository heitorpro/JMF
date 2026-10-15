package br.com.jmf.web.dto;

import br.com.jmf.domain.model.DumpsterStatus;
import br.com.jmf.domain.model.LocationSource;
import br.com.jmf.domain.model.RequestStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Payloads de entrada. Note que nenhum deles aceita customerId, customerName ou preço:
 * dono e valores são sempre determinados no servidor (regras 2 e 8).
 */
public final class Inputs {

    private Inputs() {
    }

    // ------------------------------------------------------------------ perfil

    public record UpdateMe(
            @Size(min = 2, max = 120, message = "Informe um nome entre 2 e 120 caracteres.") String name,
            @Size(max = 20, message = "Telefone inválido.") String phone,
            @Size(max = 14, message = "CPF inválido.") String cpf) {
    }

    // ------------------------------------------------------------------ endereço

    public record LocationInput(
            @NotBlank(message = "Informe o CEP.")
            @Pattern(regexp = "^\\d{5}-?\\d{3}$", message = "CEP inválido.") String postalCode,
            @NotBlank(message = "Informe a rua.") @Size(max = 160) String street,
            @NotBlank(message = "Informe o número.") @Size(max = 20) String number,
            @NotBlank(message = "Informe o bairro.") @Size(max = 120) String neighborhood,
            @Size(max = 120) String complement,
            @NotBlank(message = "Informe a cidade.") @Size(max = 120) String city,
            @NotBlank(message = "Informe o estado.")
            @Pattern(regexp = "^[A-Za-z]{2}$", message = "Use a sigla do estado (ex.: MA).") String state,
            @DecimalMin(value = "-90.0", message = "Latitude inválida.")
            @DecimalMax(value = "90.0", message = "Latitude inválida.") Double latitude,
            @DecimalMin(value = "-180.0", message = "Longitude inválida.")
            @DecimalMax(value = "180.0", message = "Longitude inválida.") Double longitude,
            LocationSource source) {
    }

    // ------------------------------------------------------------------ cliente

    public record CreateRentalRequest(
            @NotNull(message = "Informe a data desejada.") LocalDate desiredDate,
            @NotNull(message = "Informe o endereço.") @Valid LocationInput location,
            @NotBlank(message = "Descreva o material/obra.") @Size(max = 2000) String details,
            @Size(max = 2000) String notes,
            UUID attachmentId) {
    }

    /** rentalId é opcional quando o cliente tem uma única locação ativa. */
    public record CreateSwapRequest(
            UUID rentalId,
            @NotNull(message = "Informe a data desejada.") LocalDate desiredDate,
            @NotBlank(message = "Informe o motivo da troca.") @Size(max = 500) String reason,
            @Size(max = 2000) String notes) {
    }

    public record CreateRemovalRequest(
            UUID rentalId,
            @NotNull(message = "Informe a data desejada.") LocalDate desiredDate,
            @NotBlank(message = "Informe o motivo da retirada.") @Size(max = 500) String reason,
            @Size(max = 2000) String notes) {
    }

    public record CancelRequest(@Size(max = 500) String reason) {
    }

    // ------------------------------------------------------------------ gestor

    /**
     * Avança (status = próximo estado) ou rejeita (status = "rejeitada").
     * sendToMaintenance: ao finalizar retirada, envia a caçamba para manutenção em vez de "livre".
     */
    public record ChangeStatus(
            @NotNull(message = "Informe o novo status.") RequestStatus status,
            @Size(max = 1000) String notes,
            Boolean sendToMaintenance) {
    }

    /** dumpsterId opcional: sem ele, aloca a primeira caçamba livre. */
    public record Allocate(UUID dumpsterId, @Size(max = 1000) String notes) {
    }

    public record CompleteSwap(UUID replacementDumpsterId, Boolean sendOldToMaintenance,
                               @Size(max = 1000) String notes) {
    }

    public record CreateDumpster(
            @NotNull(message = "Informe o número.") @Min(1) @Max(99_999) Integer number,
            DumpsterStatus status,
            @Size(max = 500) String notes) {
    }

    /** Campos nulos não são alterados; notes = "" limpa a observação. */
    public record UpdateDumpster(DumpsterStatus status, @Size(max = 500) String notes) {
    }

    /** Atualização parcial: campos nulos permanecem inalterados. */
    public record UpdateSettings(
            @Min(0) @Max(100_000_000) Long weeklyPriceCents,
            @Min(1) @Max(90) Integer periodDays,
            @Size(max = 20) String whatsapp,
            @Email(message = "E-mail inválido.") @Size(max = 254) String email,
            @Size(max = 20) String phone,
            @Size(max = 300) String address) {
    }
}
