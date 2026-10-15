package br.com.jmf.service;

import br.com.jmf.common.ApiException;
import br.com.jmf.common.CpfValidator;
import br.com.jmf.common.PhoneNormalizer;
import br.com.jmf.common.TextSanitizer;
import br.com.jmf.domain.model.AppUser;
import br.com.jmf.domain.model.Customer;
import br.com.jmf.domain.repository.AppUserRepository;
import br.com.jmf.domain.repository.CustomerRepository;
import br.com.jmf.security.CurrentUser;
import br.com.jmf.web.dto.Inputs;
import br.com.jmf.web.dto.Views;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Service
public class MeService {

    private final AppUserRepository users;
    private final CustomerRepository customers;

    public MeService(AppUserRepository users, CustomerRepository customers) {
        this.users = users;
        this.customers = customers;
    }

    @Transactional(readOnly = true)
    public Views.MeView get(CurrentUser current) {
        AppUser user = users.findById(current.userId()).orElseThrow(ApiException::notFound);
        Customer customer = current.customerId() == null ? null
                : customers.findById(current.customerId()).orElse(null);
        return view(user, customer, current);
    }

    /**
     * Atualiza nome, telefone (obrigatório e normalizado — regra 1) e CPF opcional.
     * Chamado pelo frontend logo após o cadastro no Neon Auth para persistir o telefone informado.
     */
    @Transactional
    public Views.MeView update(CurrentUser current, Inputs.UpdateMe in) {
        AppUser user = users.findById(current.userId()).orElseThrow(ApiException::notFound);
        Customer customer = current.customerId() == null ? null
                : customers.findById(current.customerId()).orElse(null);

        if (in.name() != null) {
            String name = TextSanitizer.line(in.name(), 120);
            if (name == null || name.length() < 2) {
                throw ApiException.field("name", "Informe um nome válido.");
            }
            user.setName(name);
            if (customer != null) {
                customer.setName(name);
            }
        }
        if (in.phone() != null) {
            String phone = PhoneNormalizer.require(in.phone(), "phone");
            user.setPhone(phone);
            if (customer != null) {
                customer.setPhone(phone);
            }
        } else if (user.getPhone() == null) {
            throw ApiException.field("phone", "Informe um telefone para contato.");
        }
        if (in.cpf() != null && customer != null) {
            if (in.cpf().isBlank()) {
                customer.setCpf(null);
            } else {
                String cpf = CpfValidator.normalize(in.cpf())
                        .orElseThrow(() -> ApiException.field("cpf", "CPF inválido."));
                if (customers.existsByCpfAndIdNot(cpf, customer.getId())) {
                    // Mensagem genérica: não confirma a existência do CPF em outra conta.
                    throw ApiException.field("cpf", "Não foi possível usar este CPF.");
                }
                customer.setCpf(cpf);
            }
        }
        CurrentUser refreshed = new CurrentUser(current.userId(), current.authUserId(), user.getName(),
                user.getEmail(), user.getPhone(), current.role(), current.permissions(), current.customerId());
        return view(user, customer, refreshed);
    }

    private static Views.MeView view(AppUser user, Customer customer, CurrentUser current) {
        Views.UserView userView = new Views.UserView(user.getId(), user.getName(), user.getEmail(),
                PhoneNormalizer.format(user.getPhone()), user.getRole(), Set.copyOf(current.permissions()));
        return new Views.MeView(userView, Mappers.customerProfile(customer), user.getPhone() != null);
    }
}
