package br.com.jmf.common;

import java.util.Arrays;

/**
 * Enum com código textual estável usado no banco e no JSON (ex.: "em_entrega").
 */
public interface CodedEnum {

    String code();

    static <E extends Enum<E> & CodedEnum> E fromCode(Class<E> type, String code) {
        if (code == null) {
            return null;
        }
        String normalized = code.trim().toLowerCase();
        return Arrays.stream(type.getEnumConstants())
                .filter(value -> value.code().equals(normalized))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Valor inválido '" + code + "' para " + type.getSimpleName()));
    }
}
