package br.com.jmf.domain.model;

import br.com.jmf.common.CodedEnum;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Status da locação. */
public enum RentalStatus implements CodedEnum {
    ATIVO("ativo"),
    ENCERRADO("encerrado");

    private final String code;

    RentalStatus(String code) {
        this.code = code;
    }

    @Override
    @JsonValue
    public String code() {
        return code;
    }

    @JsonCreator
    public static RentalStatus fromCode(String code) {
        return CodedEnum.fromCode(RentalStatus.class, code);
    }
}
