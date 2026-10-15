package br.com.jmf.service;

import br.com.jmf.common.ApiException;
import br.com.jmf.common.PageParams;
import br.com.jmf.common.PageResponse;
import br.com.jmf.domain.model.Audience;
import br.com.jmf.domain.model.Notification;
import br.com.jmf.domain.model.Role;
import br.com.jmf.domain.repository.AppUserRepository;
import br.com.jmf.domain.repository.NotificationRepository;
import br.com.jmf.web.dto.Views;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.UUID;

/**
 * Notificações persistidas por usuário. Para o público "gestor", uma cópia é criada para cada
 * gestor (equipe pequena; mantém leitura individual simples).
 */
@Service
public class NotificationService {

    private final NotificationRepository notifications;
    private final AppUserRepository users;
    private final Clock clock;

    public NotificationService(NotificationRepository notifications, AppUserRepository users, Clock clock) {
        this.notifications = notifications;
        this.users = users;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void notifyUser(UUID userId, String title, String description, UUID requestId) {
        notifications.save(new Notification(userId, Audience.CLIENTE, title, description, requestId));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void notifyManagers(String title, String description, UUID requestId) {
        for (UUID managerId : users.findIdsByRole(Role.GESTOR)) {
            notifications.save(new Notification(managerId, Audience.GESTOR, title, description, requestId));
        }
    }

    @Transactional(readOnly = true)
    public PageResponse<Views.NotificationView> list(UUID userId, boolean unreadOnly, Integer page, Integer size) {
        Pageable pageable = PageParams.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Notification> result = unreadOnly
                ? notifications.findByUserIdAndReadAtIsNull(userId, pageable)
                : notifications.findByUserId(userId, pageable);
        return PageResponse.of(result, Mappers::notification);
    }

    @Transactional
    public Views.NotificationView markRead(UUID userId, UUID notificationId) {
        Notification n = notifications.findByIdAndUserId(notificationId, userId).orElseThrow(ApiException::notFound);
        n.markRead(clock.instant());
        return Mappers.notification(n);
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return notifications.countByUserIdAndReadAtIsNull(userId);
    }
}
