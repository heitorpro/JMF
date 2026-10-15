package br.com.jmf.domain.model;

import br.com.jmf.common.CodedEnum;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Público-alvo da notificação. */
public enum Audience implements CodedEnum {
    CLIENTE("cliente"),
    GESTOR("gestor"),
    AMBOS("ambos");

    private final String code;

    Audience(String code) {
        this.code = code;
    }

    @Override
    @JsonValue
    public String code() {
        return code;
    }

    @JsonCreator
    public static Audience fromCode(String code) {
        return CodedEnum.fromCode(Audience.class, code);
    }
}
