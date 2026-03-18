package com.lg.microservice.admin.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {
    private boolean success;
    private String code;
    private String message;
    private List<FieldError> errors;
    private Instant timestamp;
    private String path;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FieldError {
        private String field;
        private String message;
        private Object rejectedValue;
    }

    public static ErrorResponse of(String code, String message) {
        return ErrorResponse.builder()
                .success(false)
                .code(code)
                .message(message)
                .timestamp(Instant.now())
                .build();
    }

    public static ErrorResponse of(String code, String message, String path) {
        return ErrorResponse.builder()
                .success(false)
                .code(code)
                .message(message)
                .timestamp(Instant.now())
                .path(path)
                .build();
    }

    public static ErrorResponse of(String code, String message, List<FieldError> errors) {
        return ErrorResponse.builder()
                .success(false)
                .code(code)
                .message(message)
                .errors(errors)
                .timestamp(Instant.now())
                .build();
    }
}
