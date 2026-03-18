package com.lg.microservice.admin.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Page;

import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PageResponse<T> {
    private boolean success;
    private List<T> data;
    private PageMeta page;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PageMeta {
        private int number;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;
    }

    public static <T> PageResponse<T> of(Page<T> page) {
        return PageResponse.<T>builder()
                .success(true)
                .data(page.getContent())
                .page(PageMeta.builder()
                        .number(page.getNumber())
                        .size(page.getSize())
                        .totalElements(page.getTotalElements())
                        .totalPages(page.getTotalPages())
                        .first(page.isFirst())
                        .last(page.isLast())
                        .build())
                .build();
    }

    public static <T> PageResponse<T> of(List<T> content, int number, int size, long totalElements) {
        int totalPages = size > 0 ? (int) Math.ceil((double) totalElements / size) : 0;
        return PageResponse.<T>builder()
                .success(true)
                .data(content)
                .page(PageMeta.builder()
                        .number(number)
                        .size(size)
                        .totalElements(totalElements)
                        .totalPages(totalPages)
                        .first(number == 0)
                        .last(number >= totalPages - 1)
                        .build())
                .build();
    }
}
