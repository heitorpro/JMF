package br.com.jmf.service;

import br.com.jmf.common.ApiException;
import br.com.jmf.common.PhoneNormalizer;
import br.com.jmf.common.TextSanitizer;
import br.com.jmf.domain.model.CompanySettings;
import br.com.jmf.domain.repository.CompanySettingsRepository;
import br.com.jmf.web.dto.Inputs;
import br.com.jmf.web.dto.Views;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class SettingsService {

    private final CompanySettingsRepository repository;
    private final AuditService audit;
    private final Clock clock;

    public SettingsService(CompanySettingsRepository repository, AuditService audit, Clock clock) {
        this.repository = repository;
        this.audit = audit;
        this.clock = clock;
    }

    /** Fonte única de preço: o valor enviado pelo navegador nunca é usado (regra 8). */
    @Transactional(readOnly = true)
    public CompanySettings current() {
        return repository.findById(CompanySettings.SINGLETON_ID)
                .orElseThrow(() -> new IllegalStateException("company_settings não inicializado"));
    }

    @Transactional(readOnly = true)
    public Views.SettingsView view() {
        return Mappers.settings(current());
    }

    @Transactional
    public Views.SettingsView update(Inputs.UpdateSettings in, UUID actor) {
        CompanySettings s = current();
        Map<String, Object> before = snapshot(s);

        if (in.weeklyPriceCents() != null) {
            s.setWeeklyPriceCents(in.weeklyPriceCents());
        }
        if (in.periodDays() != null) {
            s.setPeriodDays(in.periodDays());
        }
        if (in.price15Cents() != null) {
            s.setPrice15Cents(in.price15Cents());
        }
        if (in.price30Cents() != null) {
            s.setPrice30Cents(in.price30Cents());
        }
        if (in.whatsapp() != null) {
            s.setWhatsapp(in.whatsapp().isBlank() ? null : PhoneNormalizer.require(in.whatsapp(), "whatsapp"));
        }
        if (in.phone() != null) {
            s.setPhone(in.phone().isBlank() ? null : PhoneNormalizer.require(in.phone(), "phone"));
        }
        if (in.email() != null) {
            String email = TextSanitizer.line(in.email(), 254);
            if (email != null && !email.contains("@")) {
                throw ApiException.field("email", "E-mail inválido.");
            }
            s.setEmail(email);
        }
        if (in.address() != null) {
            s.setAddress(TextSanitizer.line(in.address(), 300));
        }
        s.touch(actor, clock.instant());
        audit.log(actor, "company_settings", s.getId(), "settings.update", before, snapshot(s));
        return Mappers.settings(s);
    }

    private static Map<String, Object> snapshot(CompanySettings s) {
        Map<String, Object> m = new HashMap<>();
        m.put("weeklyPriceCents", s.getWeeklyPriceCents());
        m.put("periodDays", s.getPeriodDays());
        m.put("price15Cents", s.getPrice15Cents());
        m.put("price30Cents", s.getPrice30Cents());
        m.put("whatsapp", s.getWhatsapp());
        m.put("email", s.getEmail());
        m.put("phone", s.getPhone());
        m.put("address", s.getAddress());
        return m;
    }
}
