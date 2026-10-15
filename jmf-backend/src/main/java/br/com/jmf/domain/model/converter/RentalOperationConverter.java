package br.com.jmf.domain.model.converter;

import br.com.jmf.domain.model.RentalOperation;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class RentalOperationConverter extends CodedEnumConverter<RentalOperation> {

    public RentalOperationConverter() {
        super(RentalOperation.class);
    }
}
