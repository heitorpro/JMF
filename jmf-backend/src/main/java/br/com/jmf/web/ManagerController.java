package br.com.jmf.web;

import br.com.jmf.common.PageResponse;
import br.com.jmf.domain.model.CustomerStatus;
import br.com.jmf.domain.model.DumpsterStatus;
import br.com.jmf.domain.model.RentalStatus;
import br.com.jmf.domain.model.RequestStatus;
import br.com.jmf.domain.model.RequestType;
import br.com.jmf.security.CurrentUserProvider;
import br.com.jmf.service.AttachmentService;
import br.com.jmf.service.DumpsterService;
import br.com.jmf.service.ManagerQueryService;
import br.com.jmf.service.RequestWorkflowService;
import br.com.jmf.service.SettingsService;
import br.com.jmf.web.dto.Inputs;
import br.com.jmf.web.dto.Views;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.core.io.InputStreamResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Área do gestor. Exige ROLE_GESTOR (SecurityConfig) e, por ação, a permissão administrativa
 * correspondente (PERM_*), validadas no servidor.
 */
@Tag(name = "Gestor")
@RestController
@RequestMapping("/api/manager")
public class ManagerController {

    private final CurrentUserProvider currentUser;
    private final ManagerQueryService queries;
    private final RequestWorkflowService workflow;
    private final DumpsterService dumpsters;
    private final SettingsService settings;
    private final AttachmentService attachments;

    public ManagerController(CurrentUserProvider currentUser, ManagerQueryService queries,
                             RequestWorkflowService workflow, DumpsterService dumpsters, SettingsService settings,
                             AttachmentService attachments) {
        this.currentUser = currentUser;
        this.queries = queries;
        this.workflow = workflow;
        this.dumpsters = dumpsters;
        this.settings = settings;
        this.attachments = attachments;
    }

    // ------------------------------------------------------------------ visão geral

    @Operation(summary = "Indicadores e atividades recentes")
    @GetMapping("/overview")
    public Views.OverviewView overview() {
        return queries.overview();
    }

    // ------------------------------------------------------------------ solicitações

    @Operation(summary = "Lista paginada e filtrável de solicitações")
    @GetMapping("/requests")
    public PageResponse<Views.RequestView> requests(
            @RequestParam(required = false) List<RequestStatus> status,
            @RequestParam(required = false) RequestType type,
            @RequestParam(required = false) UUID customerId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Boolean awaitingAction,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return queries.requests(new ManagerQueryService.RequestFilter(status, type, customerId, q, from, to,
                awaitingAction), page, size);
    }

    @Operation(summary = "Detalhe e trilha de auditoria de uma solicitação")
    @GetMapping("/requests/{id}")
    public Views.RequestDetailView request(@PathVariable UUID id) {
        return queries.request(id);
    }

    @Operation(summary = "Avança no fluxo (status = próximo estado) ou rejeita (status = rejeitada)")
    @PreAuthorize("hasAuthority('PERM_REQUESTS_MANAGE')")
    @PatchMapping("/requests/{id}/status")
    public Views.RequestView changeStatus(@PathVariable UUID id, @Valid @RequestBody Inputs.ChangeStatus body) {
        return workflow.changeStatus(currentUser.get(), id, body);
    }

    @Operation(summary = "Aloca caçamba livre (informada ou a primeira disponível) a um aluguel")
    @PreAuthorize("hasAuthority('PERM_REQUESTS_MANAGE')")
    @PostMapping("/requests/{id}/allocate")
    public Views.RequestView allocate(@PathVariable UUID id,
                                      @Valid @RequestBody(required = false) Inputs.Allocate body) {
        return workflow.allocate(currentUser.get(), id, body == null ? new Inputs.Allocate(null, null) : body);
    }

    @Operation(summary = "Conclui a troca: libera a caçamba antiga e ocupa a substituta")
    @PreAuthorize("hasAuthority('PERM_REQUESTS_MANAGE')")
    @PostMapping("/requests/{id}/complete-swap")
    public Views.RequestView completeSwap(@PathVariable UUID id,
                                          @Valid @RequestBody(required = false) Inputs.CompleteSwap body) {
        return workflow.completeSwap(currentUser.get(), id,
                body == null ? new Inputs.CompleteSwap(null, false, null) : body);
    }

    @Operation(summary = "Baixa anexo de uma solicitação")
    @GetMapping("/attachments/{id}")
    public ResponseEntity<InputStreamResource> attachment(@PathVariable UUID id) {
        return Downloads.of(attachments.open(id, currentUser.get()));
    }

    // ------------------------------------------------------------------ caçambas

    @Operation(summary = "Lista caçambas (available=true: livres e sem reserva)")
    @GetMapping("/dumpsters")
    public PageResponse<Views.DumpsterView> dumpsters(@RequestParam(required = false) DumpsterStatus status,
                                                      @RequestParam(required = false) Integer number,
                                                      @RequestParam(required = false) String customer,
                                                      @RequestParam(required = false) Boolean available,
                                                      @RequestParam(required = false) Integer page,
                                                      @RequestParam(required = false) Integer size) {
        return dumpsters.list(status, number, customer, available, page, size);
    }

    @Operation(summary = "Cadastra caçamba")
    @PreAuthorize("hasAuthority('PERM_FLEET_MANAGE')")
    @PostMapping("/dumpsters")
    @ResponseStatus(HttpStatus.CREATED)
    public Views.DumpsterView createDumpster(@Valid @RequestBody Inputs.CreateDumpster body) {
        return dumpsters.create(currentUser.get(), body);
    }

    @Operation(summary = "Atualiza status (livre/manutenção/indisponível) e observações")
    @PreAuthorize("hasAuthority('PERM_FLEET_MANAGE')")
    @PatchMapping("/dumpsters/{id}")
    public Views.DumpsterView updateDumpster(@PathVariable UUID id, @Valid @RequestBody Inputs.UpdateDumpster body) {
        return dumpsters.update(currentUser.get(), id, body);
    }

    // ------------------------------------------------------------------ clientes, locações, mapa

    @Operation(summary = "Clientes com busca (nome, e-mail, telefone) e paginação")
    @PreAuthorize("hasAuthority('PERM_CUSTOMERS_VIEW')")
    @GetMapping("/customers")
    public PageResponse<Views.CustomerView> customers(@RequestParam(required = false) String q,
                                                      @RequestParam(required = false) CustomerStatus status,
                                                      @RequestParam(required = false) Integer page,
                                                      @RequestParam(required = false) Integer size) {
        return queries.customers(q, status, page, size);
    }

    @Operation(summary = "Locações")
    @PreAuthorize("hasAuthority('PERM_RENTALS_VIEW')")
    @GetMapping("/rentals")
    public PageResponse<Views.RentalView> rentals(@RequestParam(required = false) RentalStatus status,
                                                  @RequestParam(required = false) UUID customerId,
                                                  @RequestParam(required = false) Integer dumpsterNumber,
                                                  @RequestParam(required = false) Integer page,
                                                  @RequestParam(required = false) Integer size) {
        return queries.rentals(status, customerId, dumpsterNumber, page, size);
    }

    @Operation(summary = "Pontos operacionais (caçambas em campo e solicitações em aberto), máx. 500")
    @PreAuthorize("hasAuthority('PERM_MAP_VIEW')")
    @GetMapping("/map")
    public List<Views.MapPointView> map() {
        return queries.map();
    }

    // ------------------------------------------------------------------ configurações

    @Operation(summary = "Configurações da empresa")
    @GetMapping("/settings")
    public Views.SettingsView getSettings() {
        return settings.view();
    }

    @Operation(summary = "Atualiza configurações (parcial)")
    @PreAuthorize("hasAuthority('PERM_SETTINGS_MANAGE')")
    @PatchMapping("/settings")
    public Views.SettingsView updateSettings(@Valid @RequestBody Inputs.UpdateSettings body) {
        return settings.update(body, currentUser.get().userId());
    }
}
