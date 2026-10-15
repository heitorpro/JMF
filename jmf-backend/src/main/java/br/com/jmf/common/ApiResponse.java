package br.com.jmf.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

/**
 * Envelope padrão: { "data": ..., "meta": { "requestId": ... } } ou { "error": ..., "meta": ... }.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(T data, ErrorBody error, Meta meta) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(data, null, new Meta(RequestIds.current()));
    }

    public static ApiResponse<Void> error(ErrorCode code, String message, Map<String, String> fields) {
        return new ApiResponse<>(null,
                new ErrorBody(code.name(), message, fields == null || fields.isEmpty() ? null : fields),
                new Meta(RequestIds.current()));
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ErrorBody(String code, String message, Map<String, String> fields) {
    }

    public record Meta(String requestId) {
    }
}
