package br.com.jmf.service;

import br.com.jmf.common.CpfValidator;
import br.com.jmf.common.PhoneNormalizer;
import br.com.jmf.domain.model.Attachment;
import br.com.jmf.domain.model.CompanySettings;
import br.com.jmf.domain.model.Customer;
import br.com.jmf.domain.model.Dumpster;
import br.com.jmf.domain.model.Location;
import br.com.jmf.domain.model.Notification;
import br.com.jmf.domain.model.Rental;
import br.com.jmf.domain.model.RentalRequest;
import br.com.jmf.domain.model.RequestEvent;
import br.com.jmf.web.dto.Views;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/** Conversões entidade → DTO. Devem ser chamadas dentro de uma transação (associações LAZY). */
public final class Mappers {

    private Mappers() {
    }

    public static String mapsUrl(BigDecimal latitude, BigDecimal longitude) {
        if (latitude == null || longitude == null) {
            return null;
        }
        return "https://www.google.com/maps/search/?api=1&query="
                + latitude.stripTrailingZeros().toPlainString() + "," + longitude.stripTrailingZeros().toPlainString();
    }

    public static Views.LocationView location(Location l) {
        if (l == null) {
            return null;
        }
        return new Views.LocationView(l.getId(), l.getPostalCode(), l.getStreet(), l.getNumber(), l.getNeighborhood(),
                l.getComplement(), l.getCity(), l.getState(), l.getLatitude(), l.getLongitude(), l.getLabel(),
                l.getSource(), mapsUrl(l.getLatitude(), l.getLongitude()));
    }

    public static Views.AttachmentView attachment(Attachment a) {
        return a == null ? null : new Views.AttachmentView(a.getId(), a.getOriginalName(), a.getContentType(),
                a.getSizeBytes());
    }

    public static Views.RequestView request(RentalRequest r) {
        Dumpster d = r.getDumpster();
        Dumpster rep = r.getReplacementDumpster();
        return new Views.RequestView(r.getId(), r.getProtocol(), r.getType(), r.getStatus(),
                r.getCustomer().getId(), r.getCustomer().getName(),
                d == null ? null : d.getId(), d == null ? null : d.getNumber(),
                rep == null ? null : rep.getId(), rep == null ? null : rep.getNumber(),
                r.getDesiredDate(), location(r.getLocation()), r.getPriceCents(),
                r.getReason(), r.getDetails(), r.getNotes(), attachment(r.getAttachment()),
                RequestStateMachine.next(r.getType(), r.getStatus()),
                RequestStateMachine.canCancel(r.getType(), r.getStatus()),
                r.getCreatedAt(), r.getUpdatedAt());
    }

    public static Views.RequestEventView event(RequestEvent e) {
        return new Views.RequestEventView(e.getFromStatus(), e.getToStatus(), e.getNotes(), e.getCreatedAt());
    }

    public static Views.DumpsterView dumpster(Dumpster d, boolean reserved) {
        Customer c = d.getCustomer();
        return new Views.DumpsterView(d.getId(), d.getNumber(), d.label(), d.getStatus(),
                c == null ? null : c.getId(), c == null ? null : c.getName(),
                location(d.getLocation()), d.getRentalStartedAt(), d.getNotes(), reserved, d.getUpdatedAt());
    }

    public static Views.RentalView rental(Rental r) {
        return new Views.RentalView(r.getId(), r.getCustomer().getId(), r.getCustomer().getName(),
                r.getDumpster().getId(), r.getDumpster().getNumber(), r.getStartedAt(), r.getEndedAt(),
                location(r.getLocation()), r.getWeeklyPriceCents(), r.getStatus(), r.getOperation());
    }

    public static Views.CustomerProfileView customerProfile(Customer c) {
        return c == null ? null : new Views.CustomerProfileView(c.getId(), c.getName(), CpfValidator.mask(c.getCpf()),
                PhoneNormalizer.format(c.getPhone()), c.getEmail(), c.getStatus());
    }

    public static Views.CustomerView customer(Customer c, long totalRentals, List<Integer> currentDumpsters) {
        return new Views.CustomerView(c.getId(), c.getName(), initials(c.getName()), CpfValidator.mask(c.getCpf()),
                PhoneNormalizer.format(c.getPhone()), c.getEmail(), c.getStatus(), totalRentals, currentDumpsters,
                c.getCreatedAt());
    }

    public static Views.NotificationView notification(Notification n) {
        return new Views.NotificationView(n.getId(), n.getTitle(), n.getDescription(), n.getAudience(),
                n.getRequestId(), n.getReadAt() != null, n.getReadAt(), n.getCreatedAt());
    }

    public static Views.SettingsView settings(CompanySettings s) {
        return new Views.SettingsView(s.getWeeklyPriceCents(), s.getPeriodDays(),
                PhoneNormalizer.format(s.getWhatsapp()), s.getEmail(), PhoneNormalizer.format(s.getPhone()),
                s.getAddress(), s.getUpdatedAt());
    }

    /** "João da Silva" -> "JS" (mesmo comportamento do frontend). */
    public static String initials(String name) {
        if (name == null || name.isBlank()) {
            return "?";
        }
        List<String> words = Arrays.asList(name.trim().split("\\s+"));
        // ignora conectivos ("da", "de", "dos") quando há mais de uma palavra
        List<String> parts = words.size() == 1 ? words
                : words.stream().filter(p -> p.length() > 3 || !p.equals(p.toLowerCase(Locale.ROOT)))
                .collect(Collectors.toList());
        if (parts.isEmpty()) {
            parts = words;
        }
        String first = parts.get(0).substring(0, 1);
        String last = parts.size() > 1 ? parts.get(parts.size() - 1).substring(0, 1) : "";
        return (first + last).toUpperCase(Locale.ROOT);
    }
}
