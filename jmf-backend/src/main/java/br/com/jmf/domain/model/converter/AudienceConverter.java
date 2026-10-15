package br.com.jmf.domain.model.converter;

import br.com.jmf.domain.model.Audience;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class AudienceConverter extends CodedEnumConverter<Audience> {

    public AudienceConverter() {
        super(Audience.class);
    }
}
