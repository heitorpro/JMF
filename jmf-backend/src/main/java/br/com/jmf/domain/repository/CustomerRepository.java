package br.com.jmf.domain.repository;

import br.com.jmf.domain.model.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID>, JpaSpecificationExecutor<Customer> {

    Optional<Customer> findByUserId(UUID userId);

    boolean existsByCpfAndIdNot(String cpf, UUID id);

    @Query("select count(c) from Customer c where c.status = br.com.jmf.domain.model.CustomerStatus.ATIVO")
    long countActive();

    @Modifying
    @Query(value = """
            insert into customers (user_id, name, email)
            values (:userId, :name, :email)
            on conflict (user_id) do nothing
            """, nativeQuery = true)
    int insertIfAbsent(@Param("userId") UUID userId, @Param("name") String name,
                       @Param("email") String email);

    /** [customerId, total de locações] para uma página de clientes (evita N+1). */
    @Query("select r.customer.id, count(r) from Rental r where r.customer.id in :ids group by r.customer.id")
    List<Object[]> countRentalsByCustomer(@Param("ids") Collection<UUID> ids);
}
