package com.lg.microservice.admin.core.controller;

import com.lg.microservice.admin.common.response.DataResponse;
import com.lg.microservice.admin.core.model.dto.AuthCallbackResult;
import com.lg.microservice.admin.core.model.dto.AuthLogoutResult;
import com.lg.microservice.admin.core.model.dto.AuthRefreshResult;
import com.lg.microservice.admin.core.model.dto.ChangePasswordUrlResponse;
import com.lg.microservice.admin.core.model.dto.LoginUrlResponse;
import com.lg.microservice.admin.core.model.dto.LogoutResponse;
import com.lg.microservice.admin.core.model.dto.TokenRefreshResponse;
import com.lg.microservice.admin.core.model.dto.UserInfoResponse;
import com.lg.microservice.admin.core.service.AuthService;
import com.lg.microservice.admin.core.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserService userService;

    @GetMapping("/login")
    public ResponseEntity<DataResponse<LoginUrlResponse>> login() {
        return ResponseEntity.ok(DataResponse.of(authService.generateLoginUrl()));
    }

    @GetMapping("/callback")
    public ResponseEntity<Void> handleCallback(
            @RequestParam("code") String code,
            @RequestParam("state") String state) {
        AuthCallbackResult result = authService.handleCallback(code, state);

        if (!result.isSuccess()) {
            return ResponseEntity.status(302)
                    .header(HttpHeaders.LOCATION, result.getRedirectLocation())
                    .build();
        }

        return ResponseEntity.status(302)
                .header(HttpHeaders.LOCATION, result.getRedirectLocation())
                .header(HttpHeaders.SET_COOKIE, result.getRefreshTokenCookie().toString())
                .build();
    }

    @PostMapping("/refresh")
    public ResponseEntity<DataResponse<TokenRefreshResponse>> refreshToken(HttpServletRequest request) {
        AuthRefreshResult result = authService.refreshToken(request);

        if (!result.isSuccess()) {
            return ResponseEntity.status(401).build();
        }

        return ResponseEntity.ok(DataResponse.of(new TokenRefreshResponse(result.getAccessToken())));
    }

    @PostMapping("/logout")
    public ResponseEntity<DataResponse<LogoutResponse>> logout(HttpServletRequest request) {
        AuthLogoutResult result = authService.logout(request);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, result.getClearRefreshTokenCookie().toString())
                .body(DataResponse.of(new LogoutResponse(result.getLogoutUrl())));
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/me")
    public ResponseEntity<DataResponse<UserInfoResponse>> getCurrentUser() {
        return ResponseEntity.ok(DataResponse.of(userService.getCurrentUser()));
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/change-password")
    public ResponseEntity<DataResponse<ChangePasswordUrlResponse>> getChangePasswordUrl() {
        return ResponseEntity.ok(DataResponse.of(authService.generateChangePasswordUrl()));
    }
}
