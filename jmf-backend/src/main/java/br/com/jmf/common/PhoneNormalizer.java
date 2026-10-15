package br.com.jmf.common;

import java.util.Optional;

/**
 * Normaliza telefones brasileiros para o formato canônico do backend: E.164 "+55DDNNNNNNNNN".
 * Aceita entradas como "(98) 98888-8888", "98 3222-1111", "+55 98 98888-8888", "098988888888".
 */
public final class PhoneNormalizer {

    private PhoneNormalizer() {
    }

    public static Optional<String> normalize(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        String digits = raw.replaceAll("\\D", "");
        if (digits.startsWith("55") && (digits.length() == 12 || digits.length() == 13)) {
            digits = digits.substring(2);
        }
        if (digits.startsWith("0") && (digits.length() == 11 || digits.length() == 12)) {
            digits = digits.substring(1);
        }
        if (digits.length() != 10 && digits.length() != 11) {
            return Optional.empty();
        }
        // DDD: dois dígitos de 1 a 9
        if (digits.charAt(0) == '0' || digits.charAt(1) == '0') {
            return Optional.empty();
        }
        String subscriber = digits.substring(2);
        if (subscriber.length() == 9 && subscriber.charAt(0) != '9') {
            return Optional.empty(); // celular com 9 dígitos começa com 9
        }
        if (subscriber.length() == 8 && (subscriber.charAt(0) == '0' || subscriber.charAt(0) == '1')) {
            return Optional.empty();
        }
        if (subscriber.chars().distinct().count() == 1) {
            return Optional.empty(); // 99999-9999 etc.
        }
        return Optional.of("+55" + digits);
    }

    /** Normaliza ou lança VALIDATION_ERROR no campo informado. */
    public static String require(String raw, String field) {
        return normalize(raw).orElseThrow(() -> ApiException.field(field, "Informe um telefone válido com DDD."));
    }

    /** "+5598988887777" -> "(98) 98888-7777" */
    public static String format(String e164) {
        if (e164 == null || !e164.startsWith("+55")) {
            return e164;
        }
        String d = e164.substring(3);
        String ddd = d.substring(0, 2);
        String rest = d.substring(2);
        int split = rest.length() - 4;
        return "(" + ddd + ") " + rest.substring(0, split) + "-" + rest.substring(split);
    }
}
