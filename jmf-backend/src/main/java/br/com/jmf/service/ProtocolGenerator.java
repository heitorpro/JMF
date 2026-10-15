package br.com.jmf.service;

import br.com.jmf.domain.repository.RentalRequestRepository;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;

/** Código público de acompanhamento: JMF-2026-000123 (sequência do banco, sem colisões). */
@Component
public class ProtocolGenerator {

    private final RentalRequestRepository requests;
    private final Clock clock;

    public ProtocolGenerator(RentalRequestRepository requests, Clock clock) {
        this.requests = requests;
        this.clock = clock;
    }

    public String next() {
        return "JMF-%d-%06d".formatted(LocalDate.now(clock).getYear(), requests.nextProtocolNumber());
    }
}
