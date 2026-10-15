package br.com.jmf.domain.repository;

import br.com.jmf.domain.model.Rental;
import br.com.jmf.domain.model.RentalStatus;
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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RentalRepository extends JpaRepository<Rental, UUID>, JpaSpecificationExecutor<Rental> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select r from Rental r
             where r.dumpster.id = :dumpsterId and r.status = br.com.jmf.domain.model.RentalStatus.ATIVO
            """)
    Optional<Rental> lockActiveByDumpster(@Param("dumpsterId") UUID dumpsterId);

    @EntityGraph(attributePaths = {"dumpster", "location", "customer"})
    List<Rental> findByCustomerIdAndStatusOrderByStartedAtDesc(UUID customerId, RentalStatus status);

    @EntityGraph(attributePaths = {"dumpster", "location", "customer"})
    Optional<Rental> findByIdAndCustomerId(UUID id, UUID customerId);

    @Override
    @EntityGraph(attributePaths = {"dumpster", "location", "customer"})
    Page<Rental> findAll(Specification<Rental> spec, Pageable pageable);

    long countByStatus(RentalStatus status);

    @Query("""
            select coalesce(sum(r.weeklyPriceCents), 0) from Rental r
             where r.status = br.com.jmf.domain.model.RentalStatus.ATIVO
            """)
    long sumActiveWeeklyPriceCents();
}
