package br.com.jmf.domain.repository;

import br.com.jmf.domain.model.RequestEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RequestEventRepository extends JpaRepository<RequestEvent, UUID> {

    List<RequestEvent> findByRequestIdOrderByCreatedAtAsc(UUID requestId);

    List<RequestEvent> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
