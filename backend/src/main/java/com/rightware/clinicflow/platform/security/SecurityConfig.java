package com.rightware.clinicflow.platform.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

@Configuration
public class SecurityConfig {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/actuator/health/**",
                    "/api/v1/auth/csrf").permitAll()
                .anyRequest().authenticated())
            .csrf(csrf -> csrf.csrfTokenRepository(
                CookieCsrfTokenRepository.withHttpOnlyFalse()))
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(form -> form
                .loginProcessingUrl("/api/v1/auth/login")
                .usernameParameter("email")
                .passwordParameter("password")
                .successHandler((request, response, authentication) ->
                    json(response, 200, "{\"authenticated\":true}"))
                .failureHandler((request, response, exception) ->
                    json(response, 401, "{\"error\":\"INVALID_CREDENTIALS\"}")))
            .logout(logout -> logout
                .logoutUrl("/api/v1/auth/logout")
                .invalidateHttpSession(true)
                .deleteCookies("JSESSIONID")
                .logoutSuccessHandler((request, response, authentication) ->
                    json(response, 200, "{\"authenticated\":false}")))
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, exception) ->
                    json(response, 401, "{\"error\":\"UNAUTHENTICATED\"}"))
                .accessDeniedHandler((request, response, exception) ->
                    json(response, 403, "{\"error\":\"ACCESS_DENIED\"}")));
        return http.build();
    }

    private static void json(HttpServletResponse response, int code, String value)
        throws java.io.IOException {
        response.setStatus(code);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(value);
    }
}
