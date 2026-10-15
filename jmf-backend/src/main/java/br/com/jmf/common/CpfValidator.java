package br.com.jmf.common;

import java.util.Optional;

public final class CpfValidator {

    private CpfValidator() {
    }

    /** Retorna apenas os 11 dígitos se o CPF for válido (dígitos verificadores conferidos). */
    public static Optional<String> normalize(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        String cpf = raw.replaceAll("\\D", "");
        if (cpf.length() != 11 || cpf.chars().distinct().count() == 1) {
            return Optional.empty();
        }
        int d1 = checkDigit(cpf, 9);
        int d2 = checkDigit(cpf, 10);
        if (d1 != cpf.charAt(9) - '0' || d2 != cpf.charAt(10) - '0') {
            return Optional.empty();
        }
        return Optional.of(cpf);
    }

    private static int checkDigit(String cpf, int length) {
        int sum = 0;
        for (int i = 0; i < length; i++) {
            sum += (cpf.charAt(i) - '0') * (length + 1 - i);
        }
        int rest = (sum * 10) % 11;
        return rest == 10 ? 0 : rest;
    }

    /** "12345678909" -> "***.456.789-**" (nunca expor o CPF completo em listagens). */
    public static String mask(String cpf) {
        if (cpf == null || cpf.length() != 11) {
            return null;
        }
        return "***." + cpf.substring(3, 6) + "." + cpf.substring(6, 9) + "-**";
    }
}
