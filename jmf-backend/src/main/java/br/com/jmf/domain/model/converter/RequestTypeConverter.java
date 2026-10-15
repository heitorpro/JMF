package br.com.jmf.domain.model.converter;

import br.com.jmf.domain.model.RequestType;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class RequestTypeConverter extends CodedEnumConverter<RequestType> {

    public RequestTypeConverter() {
        super(RequestType.class);
    }
}
