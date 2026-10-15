package br.com.jmf.domain.model.converter;

import br.com.jmf.common.CodedEnum;
import jakarta.persistence.AttributeConverter;

/** Persiste enums pelo código textual (o mesmo usado nos CHECK constraints do banco). */
public abstract class CodedEnumConverter<E extends Enum<E> & CodedEnum> implements AttributeConverter<E, String> {

    private final Class<E> type;

    protected CodedEnumConverter(Class<E> type) {
        this.type = type;
    }

    @Override
    public String convertToDatabaseColumn(E attribute) {
        return attribute == null ? null : attribute.code();
    }

    @Override
    public E convertToEntityAttribute(String dbData) {
        return dbData == null ? null : CodedEnum.fromCode(type, dbData);
    }
}
