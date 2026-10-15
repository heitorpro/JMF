package br.com.jmf.domain.model;

import br.com.jmf.common.CodedEnum;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Origem da locação. */
public enum RentalOperation implements CodedEnum {
    LOCACAO("locacao"),
    TROCA("troca");

    private final String code;

    RentalOperation(String code) {
        this.code = code;
    }

    @Override
    @JsonValue
    public String code() {
        return code;
    }

    @JsonCreator
    public static RentalOperation fromCode(String code) {
        return CodedEnum.fromCode(RentalOperation.class, code);
    }
}
