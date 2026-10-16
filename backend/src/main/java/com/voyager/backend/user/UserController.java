package com.voyager.backend.user;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.voyager.backend.user.requestdto.*;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

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
    public ResponseEntity<?> register(@RequestBody RegisterRequest request){

        String email = request.email().trim().toLowerCase();

        if (userRepository.existsByEmailIgnoreCase(email)){
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Email already exists"));
        }
        String hashedPassword = passwordEncoder.encode(request.password());

        User user = new User(
            request.firstName(),
            request.lastName(),
            email,
            hashedPassword
         );

         User savedUser = userRepository.save(user);

         return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("message", "User registered successfully", "userId", savedUser.getId()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request){
        User user = userRepository
                    .findByEmailIgnoreCase(request.email().trim().toLowerCase())
                    .orElse(null);

        if(user == null){
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid email or password"));
        }

        boolean passwordMatches = passwordEncoder.matches(request.password(), user.getPasswordHash());

        if(!passwordMatches){
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid email or password"));
        }

        return ResponseEntity.ok(Map.of(
            "id", user.getId(),
            "firstName", user.getFirstName(),
            "lastName", user.getLastName(),
            "email", user.getEmail()
        ));
    }

}
