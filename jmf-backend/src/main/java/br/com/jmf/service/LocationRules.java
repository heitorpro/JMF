package br.com.jmf.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Regras de consistência mínima de endereço (regra 9), sem dependências de framework.
 */
public final class LocationRules {

    public static final Set<String> UFS = Set.of("AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT",
            "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO");

    // Caixa envolvente aproximada do território brasileiro.
    private static final double BR_MIN_LAT = -34.0;
    private static final double BR_MAX_LAT = 5.5;
    private static final double BR_MIN_LNG = -74.5;
    private static final double BR_MAX_LNG = -28.5;

    /**
     * @param serviceCenter    {lat, lng} do centro da área atendida, ou null para não verificar raio
     * @param serviceRadiusKm  raio máximo em km
     * @param allowedStates    UFs atendidas (vazio = todas)
     * @return erros por campo; vazio se válido
     */
    public static Map<String, String> validate(String postalCode, String state, String city, Double latitude,
                                               Double longitude, double[] serviceCenter, double serviceRadiusKm,
                                               List<String> allowedStates) {
        Map<String, String> errors = new LinkedHashMap<>();
        String cep = postalCode == null ? "" : postalCode.replaceAll("\\D", "");
        if (cep.length() != 8 || cep.chars().distinct().count() == 1) {
            errors.put("location.postalCode", "CEP inválido.");
        }
        String uf = state == null ? "" : state.trim().toUpperCase();
        if (!UFS.contains(uf)) {
            errors.put("location.state", "Estado inválido.");
        } else if (allowedStates != null && !allowedStates.isEmpty() && !allowedStates.contains(uf)) {
            errors.put("location.state", "Ainda não atendemos este estado.");
        }
        if (city == null || city.isBlank() || city.trim().length() < 2) {
            errors.put("location.city", "Cidade inválida.");
        }
        if (latitude != null && longitude != null) {
            if (Double.isNaN(latitude) || Double.isNaN(longitude) || (latitude == 0.0 && longitude == 0.0)) {
                errors.put("location.latitude", "Coordenadas inválidas.");
            } else if (latitude < BR_MIN_LAT || latitude > BR_MAX_LAT || longitude < BR_MIN_LNG || longitude > BR_MAX_LNG) {
                errors.put("location.latitude", "As coordenadas estão fora do Brasil.");
            } else if (serviceCenter != null
                    && distanceKm(serviceCenter[0], serviceCenter[1], latitude, longitude) > serviceRadiusKm) {
                errors.put("location.latitude", "Endereço fora da área de atendimento.");
            }
        } else if (latitude != null || longitude != null) {
            errors.put("location.latitude", "Informe latitude e longitude juntas.");
        }
        return errors;
    }

    /** Distância de Haversine em km. */
    public static double distanceKm(double lat1, double lng1, double lat2, double lng2) {
        double r = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * r * Math.asin(Math.sqrt(a));
    }

    /** Mesmo formato do frontend: "Bairro, Cidade — UF". */
    public static String label(String neighborhood, String city, String state) {
        return neighborhood + ", " + city + " — " + state;
    }

    private LocationRules() {
    }
}
