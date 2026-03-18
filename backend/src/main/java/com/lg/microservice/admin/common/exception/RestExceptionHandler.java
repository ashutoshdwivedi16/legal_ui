package com.lg.microservice.admin.common.exception;

import com.lg.microservice.common.lib.exception.ErrorItem;
import com.lg.microservice.common.lib.exception.ErrorResponse;
import com.lg.microservice.common.lib.exception.MicroServiceException;
import com.lg.microservice.common.lib.exception.MicroServiceExceptionHandler;
import jakarta.validation.ValidationException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

@Slf4j
@ControllerAdvice
@RequiredArgsConstructor
public class RestExceptionHandler {
    private final MicroServiceExceptionHandler microServiceExceptionHandler;

    private static final Set<String> DEV_PROFILES = Set.of("local", "dev", "qa", "dev_num", "qa_num");

    @Value("${spring.profiles.active:}")
    private String activeProfile;

    @ExceptionHandler(RestCustomException.class)
    public ResponseEntity<ErrorResponse> unwrapAndThrow(RestCustomException ex) {
        List<ErrorItem> errorItems = new ArrayList<>();
        ex.getCustomErrors()
                .forEach(errorCode -> errorItems.add(new ErrorItem(errorCode.getErrorCode(), errorCode.getMessage())));
        return new ResponseEntity<>(new ErrorResponse(errorItems), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<Object> unwrapAndThrow(ValidationException ex) {
        if (ex.getCause() instanceof MicroServiceException microServiceException) {
            return microServiceExceptionHandler.exceptionHandler(microServiceException);
        }
        return new ResponseEntity<>(
                new ErrorResponse(List.of(new ErrorItem(HttpStatus.BAD_REQUEST.name(), ex.getMessage()))),
                HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationExceptions(MethodArgumentNotValidException ex) {
        List<ErrorItem> errorItemList = new ArrayList<>();

        ex.getBindingResult().getFieldErrors().forEach(
                fieldError -> errorItemList.add(new ErrorItem(fieldError.getField(), fieldError.getDefaultMessage())));

        return new ResponseEntity<>((new ErrorResponse(errorItemList)), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingServletRequestParameterException(
            MissingServletRequestParameterException ex) {
        return new ResponseEntity<>(new ErrorResponse(List.of(new ErrorItem(ex.getParameterName(), ex.getMessage()))),
                HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthenticationException(AuthenticationException ex) {
        return new ResponseEntity<>(
                new ErrorResponse(List.of(new ErrorItem("UNAUTHORIZED", "Authentication required"))),
                HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler({AccessDeniedException.class, AuthorizationDeniedException.class})
    public ResponseEntity<ErrorResponse> handleAccessDeniedException(Exception ex) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isAuthenticated = auth != null && auth.isAuthenticated() 
                && !"anonymousUser".equals(auth.getPrincipal());
        
        if (!isAuthenticated) {
            return new ResponseEntity<>(
                    new ErrorResponse(List.of(new ErrorItem("UNAUTHORIZED", "Authentication required"))),
                    HttpStatus.UNAUTHORIZED);
        }
        
        return new ResponseEntity<>(
                new ErrorResponse(List.of(new ErrorItem("FORBIDDEN", "Access denied"))),
                HttpStatus.FORBIDDEN);
    }

    /**
     * Catch-all exception handler.
     * In dev profiles: returns full stack trace for debugging.
     * In prod profiles: returns generic error message.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleAllExceptions(Exception ex) {
        log.error("Unhandled exception occurred", ex);

        boolean isDevProfile = Arrays.stream(activeProfile.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .anyMatch(DEV_PROFILES::contains);

        if (isDevProfile) {
            return buildDetailedErrorResponse(ex);
        } else {
            return buildGenericErrorResponse();
        }
    }

    private ResponseEntity<ErrorResponse> buildDetailedErrorResponse(Exception ex) {
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        ex.printStackTrace(pw);
        String stackTrace = sw.toString();

        List<ErrorItem> errorItems = List.of(
                new ErrorItem("exception", ex.getClass().getName()),
                new ErrorItem("message", ex.getMessage() != null ? ex.getMessage() : "No message"),
                new ErrorItem("stackTrace", stackTrace)
        );
        return new ResponseEntity<>(new ErrorResponse(errorItems), HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private ResponseEntity<ErrorResponse> buildGenericErrorResponse() {
        return new ResponseEntity<>(
                new ErrorResponse(List.of(new ErrorItem("INTERNAL_ERROR", "An unexpected error occurred"))),
                HttpStatus.INTERNAL_SERVER_ERROR);
    }

}
