package br.com.jmf.domain.repository;

import br.com.jmf.domain.model.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AttachmentRepository extends JpaRepository<Attachment, UUID> {

    Optional<Attachment> findByIdAndOwnerUserId(UUID id, UUID ownerUserId);
}
