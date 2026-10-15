package br.com.jmf.common;

import org.slf4j.MDC;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.regex.Pattern;

public final class RequestIds {

    public static final String MDC_KEY = "requestId";
    public static final String HEADER = "X-Request-Id";
    private static final Pattern SAFE = Pattern.compile("^[A-Za-z0-9_-]{8,64}$");
    private static final SecureRandom RANDOM = new SecureRandom();

    private RequestIds() {
    }

    public static String generate() {
        byte[] bytes = new byte[8];
        RANDOM.nextBytes(bytes);
        return "req_" + HexFormat.of().formatHex(bytes);
    }

    /** Aceita o ID vindo do cliente/proxy apenas se for seguro para logs. */
    public static String sanitizeOrGenerate(String incoming) {
        return incoming != null && SAFE.matcher(incoming).matches() ? incoming : generate();
    }

    public static String current() {
        String id = MDC.get(MDC_KEY);
        return id != null ? id : "req_unknown";
    }
}
