package br.com.jmf.common;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * Paginação com limites rígidos: página >= 0, tamanho entre 1 e {@link #MAX_SIZE}.
 */
public final class PageParams {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;

    private PageParams() {
    }

    public static Pageable of(Integer page, Integer size, Sort sort) {
        int safePage = page == null || page < 0 ? 0 : Math.min(page, 10_000);
        int safeSize = size == null ? DEFAULT_SIZE : Math.max(1, Math.min(size, MAX_SIZE));
        return PageRequest.of(safePage, safeSize, sort);
    }
}
