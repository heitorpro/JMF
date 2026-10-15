package br.com.jmf.web;

import br.com.jmf.common.PageResponse;
import br.com.jmf.domain.model.RentalStatus;
import br.com.jmf.domain.model.RequestStatus;
import br.com.jmf.domain.model.RequestType;
import br.com.jmf.security.CurrentUserProvider;
import br.com.jmf.service.AttachmentService;
import br.com.jmf.service.ClientService;
import br.com.jmf.service.LocationService;
import br.com.jmf.web.dto.Inputs;
import br.com.jmf.web.dto.Views;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/** Área do cliente. Exige ROLE_CLIENTE (SecurityConfig). */
@Tag(name = "Cliente")
@RestController
@RequestMapping("/api/client")
public class ClientController {

    private final CurrentUserProvider currentUser;
    private final ClientService client;
    private final LocationService locations;
    private final AttachmentService attachments;

    public ClientController(CurrentUserProvider currentUser, ClientService client, LocationService locations,
                            AttachmentService attachments) {
        this.currentUser = currentUser;
        this.client = client;
        this.locations = locations;
        this.attachments = attachments;
    }

    @Operation(summary = "Resumo da conta, locações ativas e solicitações em aberto")
    @GetMapping("/dashboard")
    public Views.ClientDashboardView dashboard() {
        return client.dashboard(currentUser.get());
    }

    @Operation(summary = "Histórico de locações do cliente")
    @GetMapping("/rentals")
    public PageResponse<Views.RentalView> rentals(@RequestParam(required = false) RentalStatus status,
                                                  @RequestParam(required = false) Integer page,
                                                  @RequestParam(required = false) Integer size) {
        return client.rentals(currentUser.get(), status, page, size);
    }

    @Operation(summary = "Uma locação do cliente (inclui mapsUrl do endereço persistido)")
    @GetMapping("/rentals/{id}")
    public Views.RentalView rental(@PathVariable UUID id) {
        return client.rental(currentUser.get(), id);
    }

    @Operation(summary = "Solicitações do cliente")
    @GetMapping("/requests")
    public PageResponse<Views.RequestView> requests(@RequestParam(required = false) RequestStatus status,
                                                    @RequestParam(required = false) RequestType type,
                                                    @RequestParam(required = false) Integer page,
                                                    @RequestParam(required = false) Integer size) {
        return client.requests(currentUser.get(), status, type, page, size);
    }

    @Operation(summary = "Detalhe e histórico de status de uma solicitação do cliente")
    @GetMapping("/requests/{id}")
    public Views.RequestDetailView request(@PathVariable UUID id) {
        return client.request(currentUser.get(), id);
    }

    @Operation(summary = "Solicita novo aluguel (preço calculado no servidor)")
    @PostMapping("/requests/rental")
    @ResponseStatus(HttpStatus.CREATED)
    public Views.RequestView createRental(@Valid @RequestBody Inputs.CreateRentalRequest body) {
        return client.createRental(currentUser.get(), body);
    }

    @Operation(summary = "Solicita troca da caçamba ativa")
    @PostMapping("/requests/swap")
    @ResponseStatus(HttpStatus.CREATED)
    public Views.RequestView createSwap(@Valid @RequestBody Inputs.CreateSwapRequest body) {
        return client.createSwap(currentUser.get(), body);
    }

    @Operation(summary = "Solicita retirada da caçamba ativa")
    @PostMapping("/requests/removal")
    @ResponseStatus(HttpStatus.CREATED)
    public Views.RequestView createRemoval(@Valid @RequestBody Inputs.CreateRemovalRequest body) {
        return client.createRemoval(currentUser.get(), body);
    }

    @Operation(summary = "Cancela uma solicitação ainda não atendida")
    @PostMapping("/requests/{id}/cancel")
    public Views.RequestView cancel(@PathVariable UUID id,
                                    @Valid @RequestBody(required = false) Inputs.CancelRequest body) {
        return client.cancel(currentUser.get(), id, body);
    }

    @Operation(summary = "Valida/normaliza um endereço e, se configurado, geocodifica")
    @PostMapping("/locations/resolve")
    public Views.ResolvedLocationView resolveLocation(@Valid @RequestBody Inputs.LocationInput body) {
        return locations.preview(body);
    }

    @Operation(summary = "Envia anexo (JPG, PNG, WEBP ou PDF) para usar em uma solicitação")
    @PostMapping(value = "/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public Views.AttachmentView upload(@RequestPart("file") MultipartFile file) {
        return attachments.upload(currentUser.get(), file);
    }

    @Operation(summary = "Baixa um anexo próprio")
    @GetMapping("/attachments/{id}")
    public ResponseEntity<InputStreamResource> download(@PathVariable UUID id) {
        return Downloads.of(attachments.open(id, currentUser.get()));
    }
}
