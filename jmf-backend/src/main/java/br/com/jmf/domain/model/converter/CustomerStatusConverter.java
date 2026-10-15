package br.com.jmf.domain.model.converter;

import br.com.jmf.domain.model.CustomerStatus;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class CustomerStatusConverter extends CodedEnumConverter<CustomerStatus> {

    public CustomerStatusConverter() {
        super(CustomerStatus.class);
    }
}
