package br.com.jmf.domain.model;

import br.com.jmf.common.CodedEnum;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Estados operacionais de uma solicitação. */
public enum RequestStatus implements CodedEnum {
    PENDENTE("pendente"),
    APROVADA("aprovada"),
    EM_ENTREGA("em_entrega"),
    ENTREGUE("entregue"),
    EM_USO("em_uso"),
    TROCA_SOLICITADA("troca_solicitada"),
    EM_TROCA("em_troca"),
    RETIRADA_SOLICITADA("retirada_solicitada"),
    EM_RETIRADA("em_retirada"),
    FINALIZADA("finalizada"),
    CANCELADA("cancelada"),
    REJEITADA("rejeitada");

    private final String code;

    RequestStatus(String code) {
        this.code = code;
    }

    @Override
    @JsonValue
    public String code() {
        return code;
    }

    @JsonCreator
    public static RequestStatus fromCode(String code) {
        return CodedEnum.fromCode(RequestStatus.class, code);
    }
}
