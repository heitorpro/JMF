package br.com.jmf.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LocationRulesTest {

    private static final double[] SAO_LUIS = {-2.5297, -44.3028};

    @Test
    void enderecoValidoEmSaoLuis() {
        Map<String, String> errors = LocationRules.validate("65075-000", "MA", "São Luís", -2.4889, -44.2681,
                SAO_LUIS, 80, List.of("MA"));
        assertTrue(errors.isEmpty(), errors.toString());
    }

    @Test
    void rejeitaCepUfECoordenadasInvalidas() {
        Map<String, String> errors = LocationRules.validate("00000000", "XX", "", 0.0, 0.0, null, 0, List.of());
        assertTrue(errors.containsKey("location.postalCode"));
        assertTrue(errors.containsKey("location.state"));
        assertTrue(errors.containsKey("location.city"));
        assertTrue(errors.containsKey("location.latitude"));
    }

    @Test
    void rejeitaForaDoBrasilEForaDaAreaAtendida() {
        assertEquals("As coordenadas estão fora do Brasil.", LocationRules.validate("65075000", "MA", "São Luís",
                40.7, -74.0, null, 0, List.of()).get("location.latitude"));
        // Teresina (PI) fica a ~330 km de São Luís
        Map<String, String> far = LocationRules.validate("64000000", "MA", "Teresina", -5.0919, -42.8034,
                SAO_LUIS, 80, List.of());
        assertEquals("Endereço fora da área de atendimento.", far.get("location.latitude"));
        Map<String, String> state = LocationRules.validate("64000000", "PI", "Teresina", null, null,
                null, 0, List.of("MA"));
        assertEquals("Ainda não atendemos este estado.", state.get("location.state"));
    }

    @Test
    void exigeLatitudeELongitudeJuntas() {
        assertTrue(LocationRules.validate("65075000", "MA", "São Luís", -2.5, null, null, 0, List.of())
                .containsKey("location.latitude"));
    }

    @Test
    void rotuloNoFormatoDoFrontend() {
        assertEquals("Calhau, São Luís — MA", LocationRules.label("Calhau", "São Luís", "MA"));
    }
}
