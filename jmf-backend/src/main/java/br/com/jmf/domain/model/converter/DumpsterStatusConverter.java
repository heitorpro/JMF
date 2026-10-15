package br.com.jmf.domain.model.converter;

import br.com.jmf.domain.model.DumpsterStatus;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class DumpsterStatusConverter extends CodedEnumConverter<DumpsterStatus> {

    public DumpsterStatusConverter() {
        super(DumpsterStatus.class);
    }
}
