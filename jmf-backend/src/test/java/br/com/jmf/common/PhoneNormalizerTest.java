package br.com.jmf.common;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PhoneNormalizerTest {

    @Test
    void normalizaCelularComMascara() {
        assertEquals(Optional.of("+5598988887777"), PhoneNormalizer.normalize("(98) 98888-7777"));
    }

    @Test
    void normalizaFixoEComPrefixoInternacional() {
        assertEquals(Optional.of("+559832221111"), PhoneNormalizer.normalize("98 3222-1111"));
        assertEquals(Optional.of("+5598988887777"), PhoneNormalizer.normalize("+55 (98) 98888-7777"));
        assertEquals(Optional.of("+5598988887777"), PhoneNormalizer.normalize("098988887777"));
    }

    @Test
    void rejeitaTelefonesInvalidos() {
        assertTrue(PhoneNormalizer.normalize(null).isEmpty());
        assertTrue(PhoneNormalizer.normalize("").isEmpty());
        assertTrue(PhoneNormalizer.normalize("12345").isEmpty());
        assertTrue(PhoneNormalizer.normalize("(98) 88888-7777").isEmpty(), "celular de 9 dígitos começa com 9");
        assertTrue(PhoneNormalizer.normalize("(00) 98888-7777").isEmpty(), "DDD inválido");
        assertTrue(PhoneNormalizer.normalize("9999999999").isEmpty(), "dígitos repetidos");
    }

    @Test
    void requireLancaErroDeValidacaoNoCampo() {
        ApiException ex = assertThrows(ApiException.class, () -> PhoneNormalizer.require("abc", "phone"));
        assertEquals(ErrorCode.VALIDATION_ERROR, ex.code());
        assertTrue(ex.fields().containsKey("phone"));
    }

    @Test
    void formataParaExibicao() {
        assertEquals("(98) 98888-7777", PhoneNormalizer.format("+5598988887777"));
        assertEquals("(98) 3222-1111", PhoneNormalizer.format("+559832221111"));
    }
}
