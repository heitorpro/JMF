package br.com.jmf.service;

import br.com.jmf.common.ApiException;
import br.com.jmf.common.ErrorCode;
import br.com.jmf.common.TextSanitizer;
import br.com.jmf.config.JmfProperties;
import br.com.jmf.domain.model.Location;
import br.com.jmf.domain.model.LocationSource;
import br.com.jmf.domain.repository.LocationRepository;
import br.com.jmf.web.dto.Inputs;
import br.com.jmf.web.dto.Views;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class LocationService {

    public static final String SERVICE_CITY = "São Luís";
    public static final String SERVICE_STATE = "MA";

    private final LocationRepository locations;
    private final GeocodingProvider geocoding;
    private final JmfProperties.ServiceArea area;

    public LocationService(LocationRepository locations, GeocodingProvider geocoding, JmfProperties props) {
        this.locations = locations;
        this.geocoding = geocoding;
        this.area = props.serviceArea();
    }

    /** Endereço normalizado e validado, ainda não persistido. */
    public record Normalized(String postalCode, String street, String number, String neighborhood,
                             String complement, String city, String state, BigDecimal latitude,
                             BigDecimal longitude, String label, LocationSource source, boolean geocoded) {
    }

    /**
     * Sanitiza, valida e completa coordenadas (via provedor, se configurado).
     * @param requireCoordinates se true, falha quando não houver coordenadas ao final
     */
    public Normalized normalize(Inputs.LocationInput in, boolean requireCoordinates) {
        String postalCode = in.postalCode() == null ? null : in.postalCode().replaceAll("\\D", "");
        if (postalCode != null && postalCode.isEmpty()) {
            postalCode = null;
        }
        String street = TextSanitizer.line(in.street(), 160);
        String number = TextSanitizer.line(in.number(), 20);
        String neighborhood = TextSanitizer.line(in.neighborhood(), 120);
        String complement = TextSanitizer.line(in.complement(), 120);
        // A JMF atende somente São Luís — MA: cidade e UF são fixas no servidor.
        String city = SERVICE_CITY;
        String state = SERVICE_STATE;

        Double lat = in.latitude();
        Double lng = in.longitude();
        boolean geocoded = false;
        if ((lat == null || lng == null) && street != null && city != null) {
            Optional<GeocodingProvider.Coordinates> found = geocoding.geocode(
                    new GeocodingProvider.AddressQuery(postalCode, street, number, neighborhood, city, state));
            if (found.isPresent()) {
                lat = found.get().latitude();
                lng = found.get().longitude();
                geocoded = true;
            }
        }

        double[] center = area != null && area.enabled()
                ? new double[]{area.centerLatitude(), area.centerLongitude()} : null;
        List<String> allowedStates = area != null && area.enabled() ? area.allowedStates() : List.of();
        Map<String, String> errors = LocationRules.validate(postalCode, state, city, lat, lng, center,
                area == null ? 0 : area.radiusKm(), allowedStates);
        if (street == null) {
            errors.putIfAbsent("location.street", "Informe a rua.");
        }
        if (number == null) {
            errors.putIfAbsent("location.number", "Informe o número.");
        }
        if (neighborhood == null) {
            errors.putIfAbsent("location.neighborhood", "Informe o bairro.");
        }
        if (requireCoordinates && (lat == null || lng == null)) {
            errors.putIfAbsent("location.latitude",
                    "Não foi possível localizar o endereço. Use o GPS ou marque o ponto no mapa.");
        }
        if (!errors.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, ErrorCode.VALIDATION_ERROR.defaultMessage(), errors);
        }
        LocationSource source = in.source() == null ? LocationSource.ENDERECO : in.source();
        return new Normalized(postalCode, street, number, neighborhood, complement, city, state,
                scale(lat), scale(lng), LocationRules.label(neighborhood, city, state), source, geocoded);
    }

    @Transactional
    public Location persist(Normalized n, UUID ownerCustomerId) {
        return locations.save(new Location(ownerCustomerId, n.postalCode(), n.street(), n.number(), n.neighborhood(),
                n.complement(), n.city(), n.state(), n.latitude(), n.longitude(), n.label(), n.source()));
    }

    public Views.ResolvedLocationView preview(Inputs.LocationInput in) {
        Normalized n = normalize(in, false);
        Views.LocationView view = new Views.LocationView(null, n.postalCode(), n.street(), n.number(),
                n.neighborhood(), n.complement(), n.city(), n.state(), n.latitude(), n.longitude(), n.label(),
                n.source(), Mappers.mapsUrl(n.latitude(), n.longitude()));
        return new Views.ResolvedLocationView(view, n.geocoded());
    }

    private static BigDecimal scale(Double value) {
        return value == null ? null : BigDecimal.valueOf(value).setScale(6, RoundingMode.HALF_UP);
    }
}
