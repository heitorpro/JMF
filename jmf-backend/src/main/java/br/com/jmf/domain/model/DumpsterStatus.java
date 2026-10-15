package br.com.jmf.domain.model;

import br.com.jmf.common.CodedEnum;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Status físico/operacional da caçamba. */
public enum DumpsterStatus implements CodedEnum {
    LIVRE("livre"),
    OCUPADA("ocupada"),
    MANUTENCAO("manutencao"),
    INDISPONIVEL("indisponivel");

    private final String code;

    DumpsterStatus(String code) {
        this.code = code;
    }

    @Override
    @JsonValue
    public String code() {
        return code;
    }

    @JsonCreator
    public static DumpsterStatus fromCode(String code) {
        return CodedEnum.fromCode(DumpsterStatus.class, code);
    }
}
