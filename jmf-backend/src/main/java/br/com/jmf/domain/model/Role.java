package br.com.jmf.domain.model;

import br.com.jmf.common.CodedEnum;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Papel do usuário na aplicação. */
public enum Role implements CodedEnum {
    CLIENTE("cliente"),
    GESTOR("gestor");

    private final String code;

    Role(String code) {
        this.code = code;
    }

    @Override
    @JsonValue
    public String code() {
        return code;
    }

    @JsonCreator
    public static Role fromCode(String code) {
        return CodedEnum.fromCode(Role.class, code);
    }
}
