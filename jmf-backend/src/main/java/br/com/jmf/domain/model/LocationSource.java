package br.com.jmf.domain.model;

import br.com.jmf.common.CodedEnum;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Como o endereço foi obtido. */
public enum LocationSource implements CodedEnum {
    ENDERECO("endereco"),
    GPS("gps");

    private final String code;

    LocationSource(String code) {
        this.code = code;
    }

    @Override
    @JsonValue
    public String code() {
        return code;
    }

    @JsonCreator
    public static LocationSource fromCode(String code) {
        return CodedEnum.fromCode(LocationSource.class, code);
    }
}
