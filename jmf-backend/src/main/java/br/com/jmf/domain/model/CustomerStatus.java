package br.com.jmf.domain.model;

import br.com.jmf.common.CodedEnum;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Status do cadastro do cliente. */
public enum CustomerStatus implements CodedEnum {
    ATIVO("ativo"),
    INATIVO("inativo");

    private final String code;

    CustomerStatus(String code) {
        this.code = code;
    }

    @Override
    @JsonValue
    public String code() {
        return code;
    }

    @JsonCreator
    public static CustomerStatus fromCode(String code) {
        return CodedEnum.fromCode(CustomerStatus.class, code);
    }
}
