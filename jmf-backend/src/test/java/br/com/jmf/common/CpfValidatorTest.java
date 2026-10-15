package br.com.jmf.common;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CpfValidatorTest {

    @Test
    void aceitaCpfValidoComOuSemMascara() {
        assertEquals(Optional.of("52998224725"), CpfValidator.normalize("529.982.247-25"));
        assertEquals(Optional.of("52998224725"), CpfValidator.normalize("52998224725"));
    }

    @Test
    void rejeitaDigitoVerificadorErradoERepetidos() {
        assertTrue(CpfValidator.normalize("529.982.247-26").isEmpty());
        assertTrue(CpfValidator.normalize("111.111.111-11").isEmpty());
        assertTrue(CpfValidator.normalize("123").isEmpty());
    }

    @Test
    void mascaraNuncaExpoeCpfCompleto() {
        assertEquals("***.982.247-**", CpfValidator.mask("52998224725"));
    }
}
