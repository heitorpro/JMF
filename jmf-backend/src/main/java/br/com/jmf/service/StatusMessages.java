package br.com.jmf.service;

import br.com.jmf.domain.model.RequestStatus;
import br.com.jmf.domain.model.RequestType;

/** Textos exibidos em notificações e atividades. */
final class StatusMessages {

    private StatusMessages() {
    }

    static String typeLabel(RequestType type) {
        return switch (type) {
            case ALUGUEL -> "Novo aluguel";
            case TROCA -> "Troca de caçamba";
            case RETIRADA -> "Retirada";
        };
    }

    static String title(RequestStatus status) {
        return switch (status) {
            case PENDENTE -> "Solicitação recebida";
            case APROVADA -> "Solicitação aprovada";
            case EM_ENTREGA -> "Caçamba a caminho";
            case ENTREGUE -> "Caçamba entregue";
            case EM_USO -> "Locação em andamento";
            case TROCA_SOLICITADA -> "Troca solicitada";
            case EM_TROCA -> "Troca em andamento";
            case RETIRADA_SOLICITADA -> "Retirada solicitada";
            case EM_RETIRADA -> "Retirada a caminho";
            case FINALIZADA -> "Solicitação finalizada";
            case CANCELADA -> "Solicitação cancelada";
            case REJEITADA -> "Solicitação rejeitada";
        };
    }
}
