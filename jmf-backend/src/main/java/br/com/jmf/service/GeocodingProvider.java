package br.com.jmf.service;

import java.util.Optional;

/**
 * Ponto de extensão para geocodificação (Google, Mapbox, Nominatim...). As chaves ficam
 * apenas no servidor. O provedor ainda precisa ser confirmado (seção 14 da especificação);
 * enquanto isso, {@link DisabledGeocodingProvider} é usado e o frontend envia as coordenadas
 * (GPS ou mapa) junto com o endereço.
 */
public interface GeocodingProvider {

    record AddressQuery(String postalCode, String street, String number, String neighborhood, String city,
                        String state) {
    }

    record Coordinates(double latitude, double longitude) {
    }

    Optional<Coordinates> geocode(AddressQuery query);
}
