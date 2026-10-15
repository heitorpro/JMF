package br.com.jmf.domain.model.converter;

import br.com.jmf.domain.model.Role;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class RoleConverter extends CodedEnumConverter<Role> {

    public RoleConverter() {
        super(Role.class);
    }
}
