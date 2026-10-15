package br.com.jmf.common;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "Não foi possível concluir a solicitação."),
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "Sessão inválida ou expirada."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "Você não tem permissão para esta ação."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "Recurso não encontrado."),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "Método não permitido."),
    CONFLICT(HttpStatus.CONFLICT, "A operação conflita com o estado atual do recurso."),
    DUMPSTER_UNAVAILABLE(HttpStatus.CONFLICT, "A caçamba não está disponível."),
    INVALID_TRANSITION(HttpStatus.CONFLICT, "Mudança de status não permitida."),
    BUSINESS_RULE(HttpStatus.UNPROCESSABLE_ENTITY, "A operação não atende às regras de negócio."),
    PHONE_REQUIRED(HttpStatus.UNPROCESSABLE_ENTITY, "Informe um telefone para contato antes de continuar."),
    CUSTOMER_INACTIVE(HttpStatus.UNPROCESSABLE_ENTITY, "Cadastro de cliente inativo."),
    PAYLOAD_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "Arquivo maior que o permitido."),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "Muitas requisições. Tente novamente em instantes."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Erro inesperado. Tente novamente.");

    private final HttpStatus status;
    private final String defaultMessage;

    ErrorCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus status() {
        return status;
    }

    public String defaultMessage() {
        return defaultMessage;
    }
}
