package br.com.jmf.domain.repository;

import br.com.jmf.domain.model.AppUser;
import br.com.jmf.domain.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {

    Optional<AppUser> findByAuthUserId(String authUserId);

    @Query("select u.id from AppUser u where u.role = :role")
    List<UUID> findIdsByRole(@Param("role") Role role);

    /** Provisionamento idempotente no primeiro acesso (seguro contra requisições concorrentes). */
    @Modifying
    @Query(value = """
            insert into app_users (auth_user_id, name, email, role)
            values (:authUserId, :name, :email, :role)
            on conflict (auth_user_id) do nothing
            """, nativeQuery = true)
    int insertIfAbsent(@Param("authUserId") String authUserId, @Param("name") String name,
                       @Param("email") String email, @Param("role") String role);
}
