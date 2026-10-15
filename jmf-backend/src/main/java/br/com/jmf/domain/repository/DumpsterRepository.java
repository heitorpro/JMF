package br.com.jmf.domain.repository;

import br.com.jmf.domain.model.Dumpster;
import br.com.jmf.domain.model.DumpsterStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DumpsterRepository extends JpaRepository<Dumpster, UUID>, JpaSpecificationExecutor<Dumpster> {

    boolean existsByNumber(int number);

    /** SELECT ... FOR UPDATE: serializa operações concorrentes sobre a mesma caçamba. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Dumpster d where d.id = :id")
    Optional<Dumpster> lockById(@Param("id") UUID id);

    /**
     * Primeira caçamba livre e sem reserva, travada para esta transação.
     * SKIP LOCKED faz duas alocações simultâneas pegarem caçambas diferentes.
     */
    @Query(value = """
            select d.* from dumpsters d
             where d.status = 'livre'
               and not exists (select 1 from rental_requests r
                                where r.dumpster_id = d.id and r.type = 'aluguel'
                                  and r.status in ('pendente', 'aprovada', 'em_entrega'))
             order by d.number
             limit 1
             for update of d skip locked
            """, nativeQuery = true)
    Optional<Dumpster> lockFirstAvailable();

    @Query("select d.status, count(d) from Dumpster d group by d.status")
    List<Object[]> countByStatus();

    @EntityGraph(attributePaths = {"customer", "location"})
    List<Dumpster> findByStatusIn(Collection<DumpsterStatus> statuses);

    @Override
    @EntityGraph(attributePaths = {"customer", "location"})
    Page<Dumpster> findAll(Specification<Dumpster> spec, Pageable pageable);

    /** Caçambas atualmente com cada cliente da lista: [customerId, number]. */
    @Query("select d.customer.id, d.number from Dumpster d where d.customer.id in :ids order by d.number")
    List<Object[]> findNumbersByCustomer(@Param("ids") Collection<UUID> ids);
}
