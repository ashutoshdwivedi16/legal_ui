package com.lg.microservice.admin.common.exception;

import lombok.Getter;

import java.util.List;

/*******************************************************************************
 * File: RestCustomException
 * Date: 5/27/2025
 * Author: Muhammad Lukmanul Hakim 
 *
 *******************************************************************************/
@Getter
public class RestCustomException extends RuntimeException {

    private List<RestCustomCode> customErrors;

    public RestCustomException(final List<RestCustomCode> customErrors) {
        super();
        this.customErrors = customErrors;
    }

}