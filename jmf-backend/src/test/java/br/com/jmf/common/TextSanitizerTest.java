package br.com.jmf.common;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class TextSanitizerTest {

    @Test
    void removeTagsEControles() {
        assertEquals("Olá mundo", TextSanitizer.line("<b>Olá</b>\u0000   mundo<br/>", 100));
    }

    @Test
    void preservaQuebrasDeLinhaEmTextoMultilinha() {
        assertEquals("linha 1\nlinha 2\n\nlinha 3", TextSanitizer.multiline("linha 1\r\nlinha 2\n\n\n\nlinha 3", 100));
    }

    @Test
    void vazioViraNuloETamanhoLimitado() {
        assertNull(TextSanitizer.line("   ", 10));
        assertEquals("abcde", TextSanitizer.line("abcdefgh", 5));
    }

    @Test
    void nomeDeArquivoSeguro() {
        assertEquals("passwd", TextSanitizer.fileName("../../etc/passwd"));
        assertEquals("Orcamento obra.pdf", TextSanitizer.fileName("C:\\docs\\Orçamento obra.pdf"));
        assertEquals("nota_fiscal_.pdf", TextSanitizer.fileName("nota*fiscal?.pdf"));
        assertEquals("anexo", TextSanitizer.fileName("..."));
        assertEquals("hidden.txt", TextSanitizer.fileName(".hidden.txt"));
    }
}
