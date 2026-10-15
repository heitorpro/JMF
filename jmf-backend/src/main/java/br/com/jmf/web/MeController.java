package br.com.jmf.web;

import br.com.jmf.common.PageResponse;
import br.com.jmf.security.CurrentUserProvider;
import br.com.jmf.service.MeService;
import br.com.jmf.service.NotificationService;
import br.com.jmf.web.dto.Inputs;
import br.com.jmf.web.dto.Views;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "Perfil")
@RestController
@RequestMapping("/api/me")
public class MeController {

    private final CurrentUserProvider currentUser;
    private final MeService me;
    private final NotificationService notifications;

    public MeController(CurrentUserProvider currentUser, MeService me, NotificationService notifications) {
        this.currentUser = currentUser;
        this.me = me;
        this.notifications = notifications;
    }

    @Operation(summary = "Usuário autenticado, papel, permissões e perfil de cliente vinculado")
    @GetMapping
    public Views.MeView get() {
        return me.get(currentUser.get());
    }

    @Operation(summary = "Atualiza nome, telefone (obrigatório no perfil) e CPF opcional")
    @PatchMapping
    public Views.MeView update(@Valid @RequestBody Inputs.UpdateMe body) {
        return me.update(currentUser.get(), body);
    }

    @Operation(summary = "Notificações do usuário (paginado)")
    @GetMapping("/notifications")
    public PageResponse<Views.NotificationView> notifications(
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return notifications.list(currentUser.get().userId(), unreadOnly, page, size);
    }

    @Operation(summary = "Marca uma notificação como lida")
    @PatchMapping("/notifications/{id}/read")
    public Views.NotificationView markRead(@PathVariable UUID id) {
        return notifications.markRead(currentUser.get().userId(), id);
    }
}
