package br.com.jmf.domain.model.converter;

import br.com.jmf.domain.model.LocationSource;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class LocationSourceConverter extends CodedEnumConverter<LocationSource> {

    public LocationSourceConverter() {
        super(LocationSource.class);
    }
}
