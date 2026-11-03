package br.com.jmf.service;

import br.com.jmf.common.ApiException;
import br.com.jmf.web.dto.Views;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Resumo financeiro do gestor, calculado no banco (não depende de quantos itens as listas carregam).
 *
 * <p>Faturamento = valor das locações iniciadas no período (cada troca é uma nova locação). Todas as
 * datas usam o "hoje" de São Luís ({@link Clock} do sistema, fuso America/Fortaleza), então viradas de
 * mês e de ano acontecem no horário local.</p>
 */
@Service
public class FinanceService {

    private static final String MONTHS_SQL = """
            with months as (
              select m::date as start, (m + interval '1 month')::date as next_start
                from generate_series(date_trunc('month', cast(:first as date)),
                                     date_trunc('month', cast(:last as date)), interval '1 month') as m
            )
            select to_char(mo.start, 'YYYY-MM') as month,
                   count(r.id) as rentals,
                   count(r.id) filter (where r.operation = 'troca') as swaps,
                   coalesce(sum(r.weekly_price_cents), 0) as revenue,
                   count(distinct r.customer_id) as customers,
                   (select coalesce(sum(greatest(0,
                              least(coalesce(x.ended_at, cast(:today as date) + 1), least(mo.next_start, cast(:today as date) + 1))
                              - greatest(x.started_at, mo.start))), 0)
                      from rentals x
                     where x.started_at < least(mo.next_start, cast(:today as date) + 1)
                       and coalesce(x.ended_at, cast(:today as date) + 1) > mo.start) as occupied_days,
                   greatest(1, least(mo.next_start, cast(:today as date) + 1) - mo.start) as days
              from months mo
              left join rentals r on r.started_at >= mo.start and r.started_at < mo.next_start
             group by mo.start, mo.next_start
             order by mo.start
            """;

    private static final String PERIOD_SQL = """
            select count(*) as rentals,
                   count(*) filter (where operation = 'troca') as swaps,
                   coalesce(sum(weekly_price_cents), 0) as revenue
              from rentals
             where started_at >= :from and started_at <= :to
            """;

    private static final String DETAIL_SQL = """
            select count(*) as rentals,
                   count(*) filter (where operation = 'troca') as swaps,
                   coalesce(sum(weekly_price_cents), 0) as revenue,
                   count(distinct customer_id) as customers,
                   (select count(*) from rental_requests q
                     where q.type = 'retirada' and q.status = 'finalizada'
                       and cast(q.updated_at at time zone 'America/Fortaleza' as date) between :from and :to) as removals,
                   (select coalesce(sum(greatest(0, least(coalesce(x.ended_at, cast(:to as date) + 1), cast(:to as date) + 1)
                                              - greatest(x.started_at, cast(:from as date)))), 0)
                      from rentals x
                     where x.started_at <= :to and coalesce(x.ended_at, cast(:to as date) + 1) > :from) as occupied_days
              from rentals
             where started_at >= :from and started_at <= :to
            """;

    private static final String NEIGHBORHOODS_SQL = """
            select l.neighborhood, count(*) as rentals, coalesce(sum(r.weekly_price_cents), 0) as revenue
              from rentals r join locations l on l.id = r.location_id
             where r.started_at >= :from and r.started_at <= :to
             group by l.neighborhood
             order by count(*) desc, l.neighborhood
             limit 5
            """;

    private static final String DUE_SQL = """
            select r.id, c.name, d.number, l.neighborhood, r.started_at,
                   r.started_at + r.period_days as ends_at
              from rentals r
              join customers c on c.id = r.customer_id
              join dumpsters d on d.id = r.dumpster_id
              join locations l on l.id = r.location_id
             where r.status = 'ativo'
               and r.started_at + r.period_days between :from and :to
             order by r.started_at + r.period_days, c.name
            """;

    private final NamedParameterJdbcTemplate jdbc;
    private final Clock clock;

    public FinanceService(NamedParameterJdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Views.FinanceView summary() {
        LocalDate today = LocalDate.now(clock);
        int fleet = count("select count(*) from dumpsters", new MapSqlParameterSource());

        List<Views.FinanceMonthView> months = months(today.minusMonths(11), today, today, fleet);

        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate previousStart = monthStart.minusMonths(1);
        LocalDate previousEnd = monthStart.minusDays(1);
        // Mesmo período do mês anterior: do dia 1 até o mesmo dia (limitado ao último dia daquele mês).
        LocalDate previousSameDay = previousStart.withDayOfMonth(Math.min(today.getDayOfMonth(), previousEnd.getDayOfMonth()));

        long activeRentals = count("select count(*) from rentals where status = 'ativo'", new MapSqlParameterSource());
        long activeValue = count("select coalesce(sum(weekly_price_cents), 0) from rentals where status = 'ativo'",
                new MapSqlParameterSource());

        return new Views.FinanceView(today, fleet, months,
                period(monthStart, today),
                period(previousStart, previousSameDay),
                period(previousStart, previousEnd),
                period(today.withDayOfYear(1), today),
                activeRentals, activeValue,
                due(LocalDate.of(2000, 1, 1), today.minusDays(1), today),
                due(today, today.plusDays(2), today));
    }

    /**
     * Detalhe de um período escolhido no painel (mês, semestre, ano...), com comparação com o período
     * anterior equivalente: um mês compara com o mês anterior, um semestre com o semestre anterior, e
     * um período ainda em andamento compara com os mesmos dias do período anterior.
     */
    @Transactional(readOnly = true)
    public Views.FinancePeriodDetailView periodDetail(LocalDate from, LocalDate requestedTo) {
        LocalDate today = LocalDate.now(clock);
        if (from == null || requestedTo == null || from.isAfter(requestedTo)) {
            throw ApiException.field("from", "Informe um período válido.");
        }
        if (from.isAfter(today)) {
            throw ApiException.field("from", "O período começa no futuro.");
        }
        if (from.plusMonths(24).isBefore(requestedTo)) {
            throw ApiException.field("to", "Escolha um período de até 24 meses.");
        }
        LocalDate to = requestedTo.isAfter(today) ? today : requestedTo;
        int fleet = count("select count(*) from dumpsters", new MapSqlParameterSource());

        // Período alinhado a meses inteiros → compara com os N meses anteriores (mesmos dias se for parcial).
        boolean monthAligned = from.getDayOfMonth() == 1
                && (requestedTo.equals(requestedTo.withDayOfMonth(requestedTo.lengthOfMonth())));
        LocalDate prevFrom;
        LocalDate prevTo;
        if (monthAligned) {
            long n = java.time.temporal.ChronoUnit.MONTHS.between(from, requestedTo.plusDays(1));
            prevFrom = from.minusMonths(n);
            prevTo = to.minusMonths(n);
        } else {
            long days = to.toEpochDay() - from.toEpochDay() + 1;
            prevFrom = from.minusDays(days);
            prevTo = from.minusDays(1);
        }

        MapSqlParameterSource params = new MapSqlParameterSource("from", from).addValue("to", to);
        long totalDays = to.toEpochDay() - from.toEpochDay() + 1;
        Views.FinancePeriodDetailView detail = jdbc.queryForObject(DETAIL_SQL, params, (rs, i) -> {
            double occupancy = fleet == 0 ? 0 : Math.min(100.0, rs.getLong("occupied_days") * 100.0 / (fleet * (double) totalDays));
            return new Views.FinancePeriodDetailView(from, to, requestedTo, to.isBefore(requestedTo),
                    rs.getLong("rentals"), rs.getLong("swaps"), rs.getLong("revenue"), rs.getLong("customers"),
                    rs.getLong("removals"), Math.round(occupancy * 10) / 10.0,
                    period(prevFrom, prevTo), months(from, to, today, fleet), List.of());
        });
        List<Views.FinanceNeighborhoodView> neighborhoods = jdbc.query(NEIGHBORHOODS_SQL, params,
                (rs, i) -> new Views.FinanceNeighborhoodView(rs.getString("neighborhood"), rs.getLong("rentals"),
                        rs.getLong("revenue")));
        return new Views.FinancePeriodDetailView(detail.from(), detail.to(), detail.requestedTo(), detail.partial(),
                detail.rentals(), detail.swaps(), detail.revenueCents(), detail.customers(), detail.removals(),
                detail.occupancyPct(), detail.previous(), detail.months(), neighborhoods);
    }

    private List<Views.FinanceMonthView> months(LocalDate first, LocalDate last, LocalDate today, int fleet) {
        MapSqlParameterSource params = new MapSqlParameterSource("first", first).addValue("last", last)
                .addValue("today", today);
        return jdbc.query(MONTHS_SQL, params, (rs, i) -> {
            long occupied = rs.getLong("occupied_days");
            long days = rs.getLong("days");
            double occupancy = fleet == 0 ? 0 : Math.min(100.0, occupied * 100.0 / (fleet * (double) days));
            return new Views.FinanceMonthView(rs.getString("month"), rs.getLong("rentals"), rs.getLong("swaps"),
                    rs.getLong("revenue"), rs.getLong("customers"), Math.round(occupancy * 10) / 10.0);
        });
    }

    private Views.FinancePeriodView period(LocalDate from, LocalDate to) {
        return jdbc.queryForObject(PERIOD_SQL, new MapSqlParameterSource("from", from).addValue("to", to),
                (rs, i) -> new Views.FinancePeriodView(from, to, rs.getLong("rentals"), rs.getLong("swaps"),
                        rs.getLong("revenue")));
    }

    private List<Views.FinanceDueView> due(LocalDate from, LocalDate to, LocalDate today) {
        return jdbc.query(DUE_SQL, new MapSqlParameterSource("from", from).addValue("to", to), (rs, i) -> {
            LocalDate endsAt = rs.getObject("ends_at", LocalDate.class);
            return new Views.FinanceDueView(rs.getObject("id", UUID.class), rs.getString("name"), rs.getInt("number"),
                    rs.getString("neighborhood"), rs.getObject("started_at", LocalDate.class), endsAt,
                    today.toEpochDay() - endsAt.toEpochDay());
        });
    }

    private int count(String sql, MapSqlParameterSource params) {
        Number n = jdbc.queryForObject(sql, params, Number.class);
        return n == null ? 0 : n.intValue();
    }
}
