package com.voyager.backend.user;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import com.voyager.backend.common.Session;
import com.voyager.backend.user.requestDTO.LoginRequest;
import com.voyager.backend.user.requestDTO.RegisterRequest;

@RestController
@RequestMapping("/api/auth")
public class AuthController{

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public AuthController(UserRepository userRepository){
        this.userRepository = userRepository;
        this.passwordEncoder = new BCryptPasswordEncoder();
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request){
            if(passwordTooLong(request.password())){
                return ResponseEntity.badRequest().body(
                    Map.of("message", "Password must be at most 72 characters long")
                );
            }
            String email = normaliseEmail(request.email());

            if (userRepository.existsByEmailIgnoreCase(email)){
                return ResponseEntity.status(409).body(
                    Map.of("message", "Email already in use")
                );
            }

            User user = new User(
                request.firstName().trim(),
                request.lastName().trim(),
                email,
                passwordEncoder.encode(request.password())
            ); 
            User savedUser = userRepository.save(user);

            return ResponseEntity.status(201).body(Map.of(
                "message", "User registered successfully",
                "userId", savedUser.getId()
            ));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest){
        
        String email = normaliseEmail(request.email());
        User user = userRepository.findByEmailIgnoreCase(email).orElse(null);

        if (user == null || passwordTooLong(request.password())){
            return invalidCredentials();
        }

        boolean matches = passwordEncoder.matches(
            request.password(),
            user.getPasswordHash()

        );

        if (!matches){
            return invalidCredentials();

        }

        Session.signIn(httpRequest, user.getId());

        return ResponseEntity.ok(userDetails(user));





    }

    @GetMapping("/session")
    public ResponseEntity<?> session(HttpServletRequest request){
        UUID userId = Session.userId(request);

        if (userId == null){
            return ResponseEntity.noContent().build();

        }

        User user = userRepository.findById(userId).orElse(null);

        if (user == null){
            Session.signOut(request);
            return ResponseEntity.noContent().build();

        }
        return ResponseEntity.ok(userDetails(user));

    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request){
        Session.signOut(request);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> invalidInput(
        MethodArgumentNotValidException exception
    ){
        String message = exception.getBindingResult()
        .getFieldErrors()
        .stream()
        .map(error -> error.getField() + ": " + error.getDefaultMessage())
        .findFirst()
        .orElse("Invalid input");

        return ResponseEntity.badRequest().body(Map.of("message", message));
    }

    private String normaliseEmail(String email){
        return email.trim().toLowerCase(Locale.ROOT);

    }

    private boolean passwordTooLong(String password){
        return password.getBytes(StandardCharsets.UTF_8).length > 72;
    }

    private ResponseEntity<?> invalidCredentials(){
        return ResponseEntity.status(401).body(
            Map.of("message", "Invalid email or password")
        );

    }

    private Map<String, Object> userDetails(User user){
        return Map.of(
            "id", user.getId(),
            "firstName", user.getFirstName(),
            "lastName", user.getLastName(),
            "email", user.getEmail()
        );
    }

}
