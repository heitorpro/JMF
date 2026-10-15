package br.com.jmf.domain.model.converter;

import br.com.jmf.domain.model.RentalStatus;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class RentalStatusConverter extends CodedEnumConverter<RentalStatus> {

    public RentalStatusConverter() {
        super(RentalStatus.class);
    }
}
