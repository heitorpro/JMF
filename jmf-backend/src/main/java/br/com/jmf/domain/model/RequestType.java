package br.com.jmf.domain.model;

import br.com.jmf.common.CodedEnum;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Tipo de solicitação. */
public enum RequestType implements CodedEnum {
    ALUGUEL("aluguel"),
    TROCA("troca"),
    RETIRADA("retirada");

    private final String code;

    RequestType(String code) {
        this.code = code;
    }

    @Override
    @JsonValue
    public String code() {
        return code;
    }

    @JsonCreator
    public static RequestType fromCode(String code) {
        return CodedEnum.fromCode(RequestType.class, code);
    }
}
