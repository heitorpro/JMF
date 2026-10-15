package br.com.jmf.domain.repository;

import br.com.jmf.domain.model.RentalRequest;
import br.com.jmf.domain.model.RequestStatus;
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

public interface RentalRequestRepository extends JpaRepository<RentalRequest, UUID>,
        JpaSpecificationExecutor<RentalRequest> {

    UUID NO_ID = new UUID(0L, 0L);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RentalRequest r where r.id = :id")
    Optional<RentalRequest> lockById(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RentalRequest r where r.id = :id and r.customer.id = :customerId")
    Optional<RentalRequest> lockByIdAndCustomerId(@Param("id") UUID id, @Param("customerId") UUID customerId);

    @EntityGraph(attributePaths = {"customer", "location", "dumpster", "replacementDumpster", "attachment"})
    @Query("select r from RentalRequest r where r.id = :id")
    Optional<RentalRequest> findDetailedById(@Param("id") UUID id);

    @Override
    @EntityGraph(attributePaths = {"customer", "location", "dumpster", "replacementDumpster", "attachment"})
    Page<RentalRequest> findAll(Specification<RentalRequest> spec, Pageable pageable);

    /** Existe outra solicitação de aluguel reservando esta caçamba? Use {@link #NO_ID} quando não houver exclusão. */
    @Query("""
            select count(r) > 0 from RentalRequest r
             where r.dumpster.id = :dumpsterId
               and r.type = br.com.jmf.domain.model.RequestType.ALUGUEL
               and r.status in (br.com.jmf.domain.model.RequestStatus.PENDENTE,
                                br.com.jmf.domain.model.RequestStatus.APROVADA,
                                br.com.jmf.domain.model.RequestStatus.EM_ENTREGA)
               and r.id <> :excludeId
            """)
    boolean isReserved(@Param("dumpsterId") UUID dumpsterId, @Param("excludeId") UUID excludeId);

    @Query("""
            select r.dumpster.id from RentalRequest r
             where r.dumpster is not null
               and r.type = br.com.jmf.domain.model.RequestType.ALUGUEL
               and r.status in (br.com.jmf.domain.model.RequestStatus.PENDENTE,
                                br.com.jmf.domain.model.RequestStatus.APROVADA,
                                br.com.jmf.domain.model.RequestStatus.EM_ENTREGA)
            """)
    List<UUID> findReservedDumpsterIds();

    /** Troca ou retirada ainda em aberto para a caçamba. */
    @Query("""
            select count(r) > 0 from RentalRequest r
             where r.dumpster.id = :dumpsterId
               and r.status in (br.com.jmf.domain.model.RequestStatus.TROCA_SOLICITADA,
                                br.com.jmf.domain.model.RequestStatus.EM_TROCA,
                                br.com.jmf.domain.model.RequestStatus.RETIRADA_SOLICITADA,
                                br.com.jmf.domain.model.RequestStatus.EM_RETIRADA)
            """)
    boolean hasOpenSwapOrRemoval(@Param("dumpsterId") UUID dumpsterId);

    /** Solicitações "em uso" cuja caçamba corrente é a informada (aluguel original ou troca anterior). */
    @Query("""
            select r from RentalRequest r
             where r.status = br.com.jmf.domain.model.RequestStatus.EM_USO
               and ((r.type = br.com.jmf.domain.model.RequestType.ALUGUEL and r.dumpster.id = :dumpsterId)
                 or (r.type = br.com.jmf.domain.model.RequestType.TROCA and r.replacementDumpster.id = :dumpsterId))
            """)
    List<RentalRequest> findInUseByCurrentDumpster(@Param("dumpsterId") UUID dumpsterId);

    long countByStatusIn(Collection<RequestStatus> statuses);

    long countByCustomerIdAndStatusIn(UUID customerId, Collection<RequestStatus> statuses);

    @EntityGraph(attributePaths = {"customer", "location", "dumpster", "replacementDumpster"})
    List<RentalRequest> findTop200ByStatusInOrderByCreatedAtDesc(Collection<RequestStatus> statuses);

    @Query(value = "select nextval('rental_request_protocol_seq')", nativeQuery = true)
    long nextProtocolNumber();
}
