package br.com.jmf.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@ConditionalOnProperty(name = "jmf.geocoding.provider", havingValue = "none", matchIfMissing = true)
public class DisabledGeocodingProvider implements GeocodingProvider {

    @Override
    public Optional<Coordinates> geocode(AddressQuery query) {
        return Optional.empty();
    }
}
