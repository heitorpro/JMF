package br.com.jmf.domain.model.converter;

import br.com.jmf.domain.model.RequestStatus;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class RequestStatusConverter extends CodedEnumConverter<RequestStatus> {

    public RequestStatusConverter() {
        super(RequestStatus.class);
    }
}
