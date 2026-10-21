package com.voyager.backend.user;

import java.util.concurrent.ThreadLocalRandom;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.voyager.backend.common.ApiException;
import com.voyager.backend.common.Session;
import com.voyager.backend.demo.DemoData;
import com.voyager.backend.user.requestDTO.LoginRequest;
import com.voyager.backend.user.requestDTO.RegisterRequest;
import com.voyager.backend.user.responseDTO.ProfileResponse;

import jakarta.servlet.http.HttpSession;

/** Session sign-in. Mirrors the front end's services/mock/auth.ts. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String BAD_CREDENTIALS = "That email and password do not match.";

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public AuthController(UserRepository userRepository, BCryptPasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /** The signed-in profile, or 204 when nobody is signed in. */
    @GetMapping("/session")
    public ResponseEntity<ProfileResponse> session(HttpSession session) {
        String userId = Session.userId(session);
        if (userId == null) return ResponseEntity.noContent().build();
        return userRepository.findById(userId)
                .map(user -> ResponseEntity.ok(ProfileResponse.from(user)))
                .orElseGet(() -> {
                    // The account went away, e.g. after a demo reset.
                    Session.signOut(session);
                    return ResponseEntity.noContent().build();
                });
    }

    @PostMapping("/login")
    public ProfileResponse login(@RequestBody LoginRequest request, HttpSession session) {
        String email = normalise(request.email());
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> ApiException.invalidCredentials(BAD_CREDENTIALS));
        if (request.password() == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw ApiException.invalidCredentials(BAD_CREDENTIALS);
        }
        Session.signIn(session, user.getId());
        return ProfileResponse.from(user);
    }

    @PostMapping("/register")
    public ResponseEntity<ProfileResponse> register(@RequestBody RegisterRequest request, HttpSession session) {
        String displayName = request.displayName() == null ? "" : request.displayName().trim();
        if (displayName.isEmpty()) throw ApiException.invalid("Enter the name your group will recognise.");
        String email = normalise(request.email());
        if (email.isEmpty()) throw ApiException.invalid("Enter your email.");
        if (request.password() == null || request.password().isEmpty()) throw ApiException.invalid("Pick a password.");
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("There is already an account with that email.");
        }
        User user = userRepository.save(new User(displayName, email, passwordEncoder.encode(request.password()),
                ThreadLocalRandom.current().nextInt(360)));
        Session.signIn(session, user.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ProfileResponse.from(user));
    }

    /** Signs in as the seeded member so the demo trip can be explored immediately. */
    @PostMapping("/demo")
    public ProfileResponse demo(HttpSession session) {
        return login(new LoginRequest(DemoData.DEMO_EMAIL, DemoData.DEMO_PASSWORD), session);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpSession session) {
        Session.signOut(session);
        return ResponseEntity.noContent().build();
    }

    private static String normalise(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
