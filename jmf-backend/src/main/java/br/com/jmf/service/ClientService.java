package br.com.jmf.service;

import br.com.jmf.common.ApiException;
import br.com.jmf.common.ErrorCode;
import br.com.jmf.common.PageParams;
import br.com.jmf.common.PageResponse;
import br.com.jmf.common.TextSanitizer;
import br.com.jmf.config.JmfProperties;
import br.com.jmf.domain.model.CompanySettings;
import br.com.jmf.domain.model.Customer;
import br.com.jmf.domain.model.CustomerStatus;
import br.com.jmf.domain.model.Location;
import br.com.jmf.domain.model.Rental;
import br.com.jmf.domain.model.RentalRequest;
import br.com.jmf.domain.model.RentalStatus;
import br.com.jmf.domain.model.RequestStatus;
import br.com.jmf.domain.model.RequestType;
import br.com.jmf.domain.repository.CustomerRepository;
import br.com.jmf.domain.repository.RentalRepository;
import br.com.jmf.domain.repository.RentalRequestRepository;
import br.com.jmf.domain.repository.RequestEventRepository;
import br.com.jmf.security.CurrentUser;
import br.com.jmf.web.dto.Inputs;
import br.com.jmf.web.dto.Views;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Operações da área do cliente. Todas as consultas são escopadas pelo customerId do token (regra 2);
 * recursos de outro cliente retornam 404, sem revelar sua existência.
 */
@Service
public class ClientService {

    private final CustomerRepository customers;
    private final RentalRequestRepository requests;
    private final RentalRepository rentals;
    private final RequestEventRepository events;
    private final LocationService locations;
    private final SettingsService settings;
    private final AttachmentService attachments;
    private final AuditService audit;
    private final NotificationService notifications;
    private final ProtocolGenerator protocols;
    private final JmfProperties props;
    private final Clock clock;

    public ClientService(CustomerRepository customers, RentalRequestRepository requests, RentalRepository rentals,
                         RequestEventRepository events, LocationService locations, SettingsService settings,
                         AttachmentService attachments, AuditService audit, NotificationService notifications,
                         ProtocolGenerator protocols, JmfProperties props, Clock clock) {
        this.customers = customers;
        this.requests = requests;
        this.rentals = rentals;
        this.events = events;
        this.locations = locations;
        this.settings = settings;
        this.attachments = attachments;
        this.audit = audit;
        this.notifications = notifications;
        this.protocols = protocols;
        this.props = props;
        this.clock = clock;
    }

    // ================================================================== leitura

    @Transactional(readOnly = true)
    public Views.ClientDashboardView dashboard(CurrentUser user) {
        Customer customer = customer(user);
        List<Views.RentalView> active = rentals
                .findByCustomerIdAndStatusOrderByStartedAtDesc(customer.getId(), RentalStatus.ATIVO)
                .stream().map(Mappers::rental).toList();
        Specification<RentalRequest> open = ownedBy(customer.getId())
                .and((root, q, cb) -> cb.not(root.get("status").in(RequestStateMachine.TERMINAL)))
                .and((root, q, cb) -> cb.notEqual(root.get("status"), RequestStatus.EM_USO));
        List<Views.RequestView> openRequests = requests
                .findAll(open, PageParams.of(0, 20, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(Mappers::request).getContent();
        long totalRentals = rentals.count(rentalsOf(customer.getId()));
        CompanySettings s = settings.current();
        return new Views.ClientDashboardView(Mappers.customerProfile(customer), active, openRequests, totalRentals,
                notifications.unreadCount(user.userId()),
                new Views.PricingView(s.getWeeklyPriceCents(), s.getPeriodDays()),
                new Views.SettingsContactView(s.getWhatsapp(), s.getEmail(), s.getPhone(), s.getAddress()));
    }

    @Transactional(readOnly = true)
    public PageResponse<Views.RentalView> rentals(CurrentUser user, RentalStatus status, Integer page, Integer size) {
        Specification<Rental> spec = rentalsOf(requireCustomerId(user));
        if (status != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), status));
        }
        return PageResponse.of(rentals.findAll(spec, PageParams.of(page, size,
                Sort.by(Sort.Direction.DESC, "startedAt"))), Mappers::rental);
    }

    @Transactional(readOnly = true)
    public PageResponse<Views.RequestView> requests(CurrentUser user, RequestStatus status, RequestType type,
                                                    Integer page, Integer size) {
        Specification<RentalRequest> spec = ownedBy(requireCustomerId(user));
        if (status != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), status));
        }
        if (type != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("type"), type));
        }
        return PageResponse.of(requests.findAll(spec, PageParams.of(page, size,
                Sort.by(Sort.Direction.DESC, "createdAt"))), Mappers::request);
    }

    @Transactional(readOnly = true)
    public Views.RequestDetailView request(CurrentUser user, UUID id) {
        RentalRequest r = requests.findDetailedById(id)
                .filter(found -> found.getCustomer().getId().equals(requireCustomerId(user)))
                .orElseThrow(ApiException::notFound);
        return new Views.RequestDetailView(Mappers.request(r),
                events.findByRequestIdOrderByCreatedAtAsc(r.getId()).stream().map(Mappers::event).toList());
    }

    @Transactional(readOnly = true)
    public Views.RentalView rental(CurrentUser user, UUID rentalId) {
        return rentals.findByIdAndCustomerId(rentalId, requireCustomerId(user)).map(Mappers::rental)
                .orElseThrow(ApiException::notFound);
    }

    // ================================================================== criação

    @Transactional
    public Views.RequestView createRental(CurrentUser user, Inputs.CreateRentalRequest in) {
        Customer customer = activeCustomer(user);
        LocalDate date = validateDesiredDate(in.desiredDate());
        LocationService.Normalized normalized = locations.normalize(in.location(), true);
        Location location = locations.persist(normalized, customer.getId());

        long price = settings.current().getWeeklyPriceCents(); // nunca do navegador (regra 8)
        RentalRequest r = new RentalRequest(protocols.next(), RequestType.ALUGUEL,
                RequestStateMachine.initialStatus(RequestType.ALUGUEL), customer, location, date, price, user.userId());
        r.setDetails(TextSanitizer.multiline(in.details(), 2000));
        r.setNotes(TextSanitizer.multiline(in.notes(), 2000));
        if (r.getDetails() == null) {
            throw ApiException.field("details", "Descreva o material/obra.");
        }
        if (in.attachmentId() != null) {
            r.setAttachment(attachments.requireOwned(in.attachmentId(), user));
        }
        requests.saveAndFlush(r);
        audit.requestEvent(r, null, r.getStatus(), user.userId(), "Solicitação criada pelo cliente.");
        notifications.notifyManagers("Nova solicitação de aluguel",
                customer.getName() + " · " + location.getLabel() + " · " + r.getProtocol(), r.getId());
        return Mappers.request(r);
    }

    @Transactional
    public Views.RequestView createSwap(CurrentUser user, Inputs.CreateSwapRequest in) {
        return createFromActiveRental(user, RequestType.TROCA, in.rentalId(), in.desiredDate(), in.reason(), in.notes());
    }

    @Transactional
    public Views.RequestView createRemoval(CurrentUser user, Inputs.CreateRemovalRequest in) {
        return createFromActiveRental(user, RequestType.RETIRADA, in.rentalId(), in.desiredDate(), in.reason(),
                in.notes());
    }

    private Views.RequestView createFromActiveRental(CurrentUser user, RequestType type, UUID rentalId,
                                                     LocalDate desiredDate, String reason, String notes) {
        Customer customer = activeCustomer(user);
        LocalDate date = validateDesiredDate(desiredDate);
        Rental rental = activeRental(customer, rentalId);
        if (requests.hasOpenSwapOrRemoval(rental.getDumpster().getId())) {
            throw ApiException.conflict("Já existe uma troca ou retirada em aberto para esta caçamba.");
        }
        long price = type == RequestType.TROCA ? settings.current().getWeeklyPriceCents() : 0L;
        // Endereço e caçamba vêm da locação persistida, não do navegador.
        RentalRequest r = new RentalRequest(protocols.next(), type, RequestStateMachine.initialStatus(type), customer,
                rental.getLocation(), date, price, user.userId());
        r.setDumpster(rental.getDumpster());
        r.setReason(TextSanitizer.line(reason, 500));
        r.setNotes(TextSanitizer.multiline(notes, 2000));
        if (r.getReason() == null) {
            throw ApiException.field("reason", "Informe o motivo.");
        }
        requests.saveAndFlush(r); // índice único impede duas aberturas simultâneas
        audit.requestEvent(r, null, r.getStatus(), user.userId(), "Solicitação criada pelo cliente.");
        notifications.notifyManagers(StatusMessages.typeLabel(type) + " solicitada",
                customer.getName() + " · caçamba " + rental.getDumpster().label() + " · " + r.getProtocol(), r.getId());
        return Mappers.request(r);
    }

    @Transactional
    public Views.RequestView cancel(CurrentUser user, UUID id, Inputs.CancelRequest in) {
        RentalRequest r = requests.lockByIdAndCustomerId(id, requireCustomerId(user))
                .orElseThrow(ApiException::notFound);
        if (!RequestStateMachine.canCancel(r.getType(), r.getStatus())) {
            throw new ApiException(ErrorCode.INVALID_TRANSITION,
                    "Esta solicitação não pode mais ser cancelada. Fale com a JMF.");
        }
        RequestStatus from = r.getStatus();
        r.setStatus(RequestStatus.CANCELADA);
        requests.flush();
        String reason = in == null ? null : TextSanitizer.line(in.reason(), 500);
        audit.requestEvent(r, from, RequestStatus.CANCELADA, user.userId(),
                reason == null ? "Cancelada pelo cliente." : "Cancelada pelo cliente: " + reason);
        notifications.notifyManagers("Solicitação cancelada",
                r.getCustomer().getName() + " cancelou " + r.getProtocol(), r.getId());
        return Mappers.request(r);
    }

    // ================================================================== apoio

    private Rental activeRental(Customer customer, UUID rentalId) {
        if (rentalId != null) {
            return rentals.findByIdAndCustomerId(rentalId, customer.getId())
                    .filter(r -> r.getStatus() == RentalStatus.ATIVO)
                    .orElseThrow(() -> ApiException.notFound("Locação ativa não encontrada."));
        }
        List<Rental> active = rentals.findByCustomerIdAndStatusOrderByStartedAtDesc(customer.getId(), RentalStatus.ATIVO);
        if (active.isEmpty()) {
            throw ApiException.rule("Você não possui caçamba ativa.");
        }
        if (active.size() > 1) {
            throw ApiException.field("rentalId", "Selecione qual caçamba.");
        }
        return active.get(0);
    }

    private LocalDate validateDesiredDate(LocalDate date) {
        LocalDate today = LocalDate.now(clock);
        int maxDays = props.requests() == null ? 90 : props.requests().maxDaysAhead();
        if (date == null || date.isBefore(today)) {
            throw ApiException.field("desiredDate", "A data não pode estar no passado.");
        }
        if (date.isAfter(today.plusDays(maxDays))) {
            throw ApiException.field("desiredDate", "Escolha uma data em até " + maxDays + " dias.");
        }
        return date;
    }

    private Customer customer(CurrentUser user) {
        return customers.findById(requireCustomerId(user)).orElseThrow(ApiException::notFound);
    }

    /** Cliente apto a solicitar: ativo e com telefone (regra 1). */
    private Customer activeCustomer(CurrentUser user) {
        Customer c = customer(user);
        if (c.getStatus() != CustomerStatus.ATIVO) {
            throw new ApiException(ErrorCode.CUSTOMER_INACTIVE);
        }
        if (c.getPhone() == null) {
            throw new ApiException(ErrorCode.PHONE_REQUIRED);
        }
        return c;
    }

    private static UUID requireCustomerId(CurrentUser user) {
        if (user.customerId() == null) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }
        return user.customerId();
    }

    private static Specification<RentalRequest> ownedBy(UUID customerId) {
        return (root, q, cb) -> cb.equal(root.get("customer").get("id"), customerId);
    }

    private static Specification<Rental> rentalsOf(UUID customerId) {
        return (root, q, cb) -> cb.equal(root.get("customer").get("id"), customerId);
    }
}
