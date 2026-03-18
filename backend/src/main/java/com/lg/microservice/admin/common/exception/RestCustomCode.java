package com.lg.microservice.admin.common.exception;

import lombok.Getter;

@Getter
public enum RestCustomCode {

    UNEXPECTED("UNEXPECTED", ErrorConstants.UNEXPECTED);

    private final String errorCode;

    private final String message;


    RestCustomCode(final String errorCode, final String message) {
        this.errorCode = errorCode;
        this.message = message;
    }

}