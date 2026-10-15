package br.com.jmf.common;

import java.util.Map;

/**
 * Exceção de domínio convertida no contrato de erro padrão.
 * A mensagem é exibida ao cliente, portanto nunca deve conter dados sensíveis.
 */
public class ApiException extends RuntimeException {

    private final ErrorCode code;
    private final Map<String, String> fields;

    public ApiException(ErrorCode code) {
        this(code, code.defaultMessage(), Map.of());
    }

    public ApiException(ErrorCode code, String message) {
        this(code, message, Map.of());
    }

    public ApiException(ErrorCode code, String message, Map<String, String> fields) {
        super(message);
        this.code = code;
        this.fields = fields == null ? Map.of() : Map.copyOf(fields);
    }

    public ErrorCode code() {
        return code;
    }

    public Map<String, String> fields() {
        return fields;
    }

    public static ApiException notFound() {
        return new ApiException(ErrorCode.NOT_FOUND);
    }

    public static ApiException notFound(String message) {
        return new ApiException(ErrorCode.NOT_FOUND, message);
    }

    public static ApiException rule(String message) {
        return new ApiException(ErrorCode.BUSINESS_RULE, message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(ErrorCode.CONFLICT, message);
    }

    public static ApiException field(String field, String message) {
        return new ApiException(ErrorCode.VALIDATION_ERROR, ErrorCode.VALIDATION_ERROR.defaultMessage(),
                Map.of(field, message));
    }
}
