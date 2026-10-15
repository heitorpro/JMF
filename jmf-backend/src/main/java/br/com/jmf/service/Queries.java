package br.com.jmf.service;

import java.util.Locale;

final class Queries {

    private Queries() {
    }

    /** Termo para LIKE com curingas escapados (caractere de escape: '\'), em minúsculas. */
    static String likeTerm(String raw) {
        if (raw == null) {
            return null;
        }
        String term = raw.trim();
        if (term.isEmpty()) {
            return null;
        }
        if (term.length() > 80) {
            term = term.substring(0, 80);
        }
        term = term.toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + term + "%";
    }
}
