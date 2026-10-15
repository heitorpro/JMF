package br.com.jmf.domain.repository;

import br.com.jmf.domain.model.CompanySettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompanySettingsRepository extends JpaRepository<CompanySettings, Short> {
}
