package br.com.jmf.common;

import java.text.Normalizer;
import java.util.regex.Pattern;

/**
 * Sanitização de texto livre: remove tags HTML, caracteres de controle e espaços redundantes.
 * O frontend React já escapa a saída; isto é defesa em profundidade para outros consumidores
 * (e-mail, WhatsApp, planilhas).
 */
public final class TextSanitizer {

    private static final Pattern TAGS = Pattern.compile("<[^>]*>");
    private static final Pattern CONTROL = Pattern.compile("[\\p{Cntrl}&&[^\\n\\t]]");
    private static final Pattern SPACES = Pattern.compile("[ \\t]+");
    private static final Pattern MANY_NEWLINES = Pattern.compile("\\n{3,}");
    private static final Pattern UNSAFE_FILE_CHARS = Pattern.compile("[^A-Za-z0-9._ -]");

    private TextSanitizer() {
    }

    /** Texto multilinha (detalhes, observações). Retorna null para vazio. */
    public static String multiline(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        String result = Normalizer.normalize(value, Normalizer.Form.NFC)
                .replace("\r\n", "\n").replace('\r', '\n');
        result = TAGS.matcher(result).replaceAll("");
        result = CONTROL.matcher(result).replaceAll("");
        result = SPACES.matcher(result).replaceAll(" ");
        result = MANY_NEWLINES.matcher(result).replaceAll("\n\n").strip();
        if (result.isEmpty()) {
            return null;
        }
        return result.length() > maxLength ? result.substring(0, maxLength) : result;
    }

    /** Texto de linha única (nome, rua, bairro). Retorna null para vazio. */
    public static String line(String value, int maxLength) {
        String result = multiline(value, Integer.MAX_VALUE);
        if (result == null) {
            return null;
        }
        result = result.replace('\n', ' ').replace('\t', ' ');
        result = SPACES.matcher(result).replaceAll(" ").strip();
        return result.length() > maxLength ? result.substring(0, maxLength) : result;
    }

    /**
     * Nome de arquivo seguro para exibição: sem caminho, sem acentos/caracteres especiais,
     * sem nomes ocultos, limitado em tamanho. Nunca é usado como caminho no disco.
     */
    public static String fileName(String original) {
        String name = original == null ? "" : original;
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        name = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        name = UNSAFE_FILE_CHARS.matcher(name).replaceAll("_");
        name = name.replaceAll("\\.{2,}", ".").replaceAll("^[.\\s]+", "").strip();
        if (name.isEmpty()) {
            name = "anexo";
        }
        if (name.length() > 120) {
            int dot = name.lastIndexOf('.');
            String ext = dot > 0 && name.length() - dot <= 10 ? name.substring(dot) : "";
            name = name.substring(0, 120 - ext.length()) + ext;
        }
        return name;
    }
}
