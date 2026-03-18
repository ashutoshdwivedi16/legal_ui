package com.lg.microservice.admin.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DataResponse<T> {
    private boolean success;
    private T data;
    private String message;

    public static <T> DataResponse<T> of(T data) {
        return DataResponse.<T>builder()
                .success(true)
                .data(data)
                .build();
    }

    public static <T> DataResponse<T> of(T data, String message) {
        return DataResponse.<T>builder()
                .success(true)
                .data(data)
                .message(message)
                .build();
    }

    public static <T> DataResponse<T> error(String message) {
        return DataResponse.<T>builder()
                .success(false)
                .message(message)
                .build();
    }
}
