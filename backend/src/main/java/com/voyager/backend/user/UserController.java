package com.voyager.backend.user;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.voyager.backend.common.ErrorResponse;
import com.voyager.backend.user.requestdto.*;
import com.voyager.backend.user.responsedto.UserResponse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api/auth")
public class UserController {

    private static final int MIN_PASSWORD_LENGTH = 6; // Same rule as the frontend sign-up form.
    private static final int MAX_PASSWORD_BYTES = 72; // BCrypt ignores (or, in newer versions, rejects) anything past this.

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    // Writes the signed-in user into the HTTP session, which is what the cookie points at.
    private final SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();

    public UserController(UserRepository userRepository, PasswordEncoder passwordEncoder){
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    private static boolean isBlank(String value){
        return value == null || value.isBlank();
    }

    private static boolean tooLongForBcrypt(String password){
        return password.getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES;
    }

    // Starts a brand new session for this user. Any old session is thrown away first, so a session id
    // an attacker planted before login is worthless afterwards (session fixation).
    private void signIn(User user, HttpServletRequest request, HttpServletResponse response){
        HttpSession old = request.getSession(false);
        if (old != null){
            old.invalidate();
        }

        Authentication authentication =
            UsernamePasswordAuthenticationToken.authenticated(user.getId().toString(), null, List.of());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }

    // Creates the account and signs the new member straight in, as the frontend's sign-up does.
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse){

        if (isBlank(request.displayName())){
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorResponse.invalid("Enter the name your group will recognise."));
        }
        if (isBlank(request.email()) || !request.email().contains("@")){
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorResponse.invalid("That does not look like an email."));
        }
        if (request.password() == null || request.password().length() < MIN_PASSWORD_LENGTH){
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorResponse.invalid("Use at least " + MIN_PASSWORD_LENGTH + " characters."));
        }
        if (tooLongForBcrypt(request.password())){
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorResponse.invalid("That password is too long. Use 72 bytes or fewer."));
        }

        String email = request.email().trim().toLowerCase();

        if (userRepository.existsByEmailIgnoreCase(email)){
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.conflict("There is already an account with that email."));
        }

        User user = new User(
            request.displayName().trim(),
            email,
            passwordEncoder.encode(request.password()),
            ThreadLocalRandom.current().nextInt(360)
        );

        User savedUser;
        try {
            savedUser = userRepository.save(user);
        } catch (DataIntegrityViolationException e) {
            // Two sign-ups with the same email at the same moment: the database constraint decided it.
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.conflict("There is already an account with that email."));
        }

        signIn(savedUser, httpRequest, httpResponse);
        return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(savedUser));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse){
        if (isBlank(request.email()) || request.password() == null || tooLongForBcrypt(request.password())){
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse.invalidCredentials());
        }

        User user = userRepository
                    .findByEmailIgnoreCase(request.email().trim().toLowerCase())
                    .orElse(null);

        // The same answer for an unknown email and a wrong password, so this cannot be used to find out who has an account.
        if(user == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())){
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse.invalidCredentials());
        }

        signIn(user, httpRequest, httpResponse);
        return ResponseEntity.ok(UserResponse.from(user));
    }

    // Who am I? This is what the frontend asks on load. 401 (from the security config) means nobody is signed in.
    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication authentication){
        UUID userId = UUID.fromString(authentication.getName());

        return userRepository.findById(userId)
                .<ResponseEntity<?>>map(user -> ResponseEntity.ok(UserResponse.from(user)))
                // A valid session for an account that no longer exists is no session at all.
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse.forbidden("Sign in to do that.")));
    }

    // Safe to call when already signed out, so the frontend never has to care.
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request){
        HttpSession session = request.getSession(false);
        if (session != null){
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

}
