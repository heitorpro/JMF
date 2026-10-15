package br.com.jmf.common;

import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Converte exceções no contrato de erro. Mensagens ao cliente são genéricas; detalhes vão
 * apenas para o log (com requestId) e nunca incluem payloads, CPF ou tokens.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiResponse<Void>> handleApi(ApiException ex) {
        if (ex.code().status().is5xxServerError()) {
            log.error("Erro de aplicação: {}", ex.code());
        }
        return respond(ex.code(), ex.getMessage(), ex.fields());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiResponse<Void>> handleInvalidBody(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        ex.getBindingResult().getGlobalErrors()
                .forEach(error -> fields.putIfAbsent(error.getObjectName(), error.getDefaultMessage()));
        return respond(ErrorCode.VALIDATION_ERROR, ErrorCode.VALIDATION_ERROR.defaultMessage(), fields);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ResponseEntity<ApiResponse<Void>> handleMethodValidation(HandlerMethodValidationException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getParameterValidationResults().forEach(result -> {
            String name = result.getMethodParameter().getParameterName();
            result.getResolvableErrors().forEach(e -> fields.putIfAbsent(name == null ? "param" : name,
                    e.getDefaultMessage()));
        });
        return respond(ErrorCode.VALIDATION_ERROR, ErrorCode.VALIDATION_ERROR.defaultMessage(), fields);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ApiResponse<Void>> handleConstraint(ConstraintViolationException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getConstraintViolations().forEach(v -> {
            String path = v.getPropertyPath().toString();
            fields.putIfAbsent(path.contains(".") ? path.substring(path.lastIndexOf('.') + 1) : path, v.getMessage());
        });
        return respond(ErrorCode.VALIDATION_ERROR, ErrorCode.VALIDATION_ERROR.defaultMessage(), fields);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestPartException.class,
            HttpMediaTypeNotSupportedException.class})
    ResponseEntity<ApiResponse<Void>> handleUnreadable(Exception ex) {
        return respond(ErrorCode.VALIDATION_ERROR, "Corpo da requisição inválido.", null);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return respond(ErrorCode.VALIDATION_ERROR, ErrorCode.VALIDATION_ERROR.defaultMessage(),
                Map.of(ex.getName(), "Valor inválido."));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ResponseEntity<ApiResponse<Void>> handleMissingParam(MissingServletRequestParameterException ex) {
        return respond(ErrorCode.VALIDATION_ERROR, ErrorCode.VALIDATION_ERROR.defaultMessage(),
                Map.of(ex.getParameterName(), "Obrigatório."));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        log.debug("Argumento inválido: {}", ex.getMessage());
        return respond(ErrorCode.VALIDATION_ERROR, ErrorCode.VALIDATION_ERROR.defaultMessage(), null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiResponse<Void>> handleDenied(AccessDeniedException ex) {
        return respond(ErrorCode.FORBIDDEN, ErrorCode.FORBIDDEN.defaultMessage(), null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiResponse<Void>> handleIntegrity(DataIntegrityViolationException ex) {
        String constraint = constraintName(ex);
        log.warn("Violação de integridade: {}", constraint);
        if (constraint != null && constraint.startsWith("ux_requests_dumpster_reserved")) {
            return respond(ErrorCode.DUMPSTER_UNAVAILABLE, "A caçamba já está reservada para outra solicitação.", null);
        }
        if (constraint != null && constraint.startsWith("ux_requests_open_swap_removal")) {
            return respond(ErrorCode.CONFLICT, "Já existe uma troca ou retirada em aberto para esta caçamba.", null);
        }
        if (constraint != null && constraint.startsWith("ux_rentals_active_dumpster")) {
            return respond(ErrorCode.DUMPSTER_UNAVAILABLE, "A caçamba já possui uma locação ativa.", null);
        }
        return respond(ErrorCode.CONFLICT, ErrorCode.CONFLICT.defaultMessage(), null);
    }

    @ExceptionHandler(ConcurrencyFailureException.class)
    ResponseEntity<ApiResponse<Void>> handleConcurrency(ConcurrencyFailureException ex) {
        log.info("Conflito de concorrência: {}", ex.getClass().getSimpleName());
        return respond(ErrorCode.CONFLICT, "O recurso foi alterado por outra operação. Atualize e tente novamente.", null);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiResponse<Void>> handleUploadSize(MaxUploadSizeExceededException ex) {
        return respond(ErrorCode.PAYLOAD_TOO_LARGE, ErrorCode.PAYLOAD_TOO_LARGE.defaultMessage(), null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiResponse<Void>> handleNoResource(NoResourceFoundException ex) {
        return respond(ErrorCode.NOT_FOUND, ErrorCode.NOT_FOUND.defaultMessage(), null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiResponse<Void>> handleMethod(HttpRequestMethodNotSupportedException ex) {
        return respond(ErrorCode.METHOD_NOT_ALLOWED, ErrorCode.METHOD_NOT_ALLOWED.defaultMessage(), null);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception ex) {
        log.error("Erro inesperado", ex);
        return respond(ErrorCode.INTERNAL_ERROR, ErrorCode.INTERNAL_ERROR.defaultMessage(), null);
    }

    private static ResponseEntity<ApiResponse<Void>> respond(ErrorCode code, String message, Map<String, String> fields) {
        return ResponseEntity.status(code.status()).body(ApiResponse.error(code, message, fields));
    }

    private static String constraintName(DataIntegrityViolationException ex) {
        Throwable cause = ex.getCause();
        while (cause != null) {
            if (cause instanceof org.hibernate.exception.ConstraintViolationException cve) {
                return cve.getConstraintName();
            }
            cause = cause.getCause();
        }
        String message = ex.getMostSpecificCause().getMessage();
        if (message != null) {
            for (String known : new String[]{"ux_requests_dumpster_reserved", "ux_requests_open_swap_removal",
                    "ux_rentals_active_dumpster", "dumpsters_number_key", "customers_cpf_key"}) {
                if (message.contains(known)) {
                    return known;
                }
            }
        }
        return null;
    }
}
