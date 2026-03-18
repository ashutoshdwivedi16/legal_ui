package com.lg.microservice.admin.core.service;

import com.lg.microservice.admin.core.model.dto.AuthCallbackResult;
import com.lg.microservice.admin.core.model.dto.AuthLogoutResult;
import com.lg.microservice.admin.core.model.dto.AuthRefreshResult;
import com.lg.microservice.admin.core.model.dto.ChangePasswordUrlResponse;
import com.lg.microservice.admin.core.model.dto.LoginUrlResponse;
import jakarta.servlet.http.HttpServletRequest;

public interface AuthService {

    LoginUrlResponse generateLoginUrl();

    AuthCallbackResult handleCallback(String code, String state);

    AuthRefreshResult refreshToken(HttpServletRequest request);

    AuthLogoutResult logout(HttpServletRequest request);

    ChangePasswordUrlResponse generateChangePasswordUrl();
}
