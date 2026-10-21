package com.voyager.backend.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

// Login is a server-side session held in an HttpOnly cookie (see the server.servlet.session
// settings in application.yaml). The browser sends the cookie by itself and JavaScript cannot read it.
// Logging out ends the session on the server straight away, so the cookie stops working at once, and
// the chat sockets that session opened are closed with it (chat/SignOutClosesSockets).

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // CSRF tokens are switched off on purpose, which is a decision worth revisiting before this ships.
            // What stands in for them: the session cookie is SameSite=Lax, so browsers do not send it on
            // cross-site POSTs, and every endpoint that changes data only accepts a JSON body.
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/register", "/api/auth/login", "/api/auth/logout").permitAll()
                .requestMatchers("/error").permitAll() // Otherwise a bad request is reported as a 401.
                // A calendar app subscribing to a trip's calendar cannot send the login cookie. The token
                // in the address is its key (see CalendarService), and it is read-only, so GET (and HEAD) only.
                .requestMatchers(HttpMethod.GET, "/api/calendar/feeds/*").permitAll()
                .requestMatchers(HttpMethod.HEAD, "/api/calendar/feeds/*").permitAll()
                .anyRequest().authenticated())
            // Not signed in is a plain 401 for the frontend to act on, never a redirect to a login page.
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)));
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
