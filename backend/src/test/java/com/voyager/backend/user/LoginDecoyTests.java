package com.voyager.backend.user;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.voyager.backend.user.requestdto.LoginRequest;

// Signing in with an email that has no account must cost the same as a wrong password, or the
// difference in time would tell a stranger which emails have accounts. Time itself is too noisy to
// assert on, so this checks the cause: the password is checked against something either way.
// It builds the controller by hand, with no server, which is why it needs no database.

class LoginDecoyTests {

    @Test
    void anEmailWithNoAccountStillGetsItsPasswordCheckedAgainstARealHash() {
        List<String> hashesChecked = new ArrayList<>();
        BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder(4); // Cheap rounds: speed is not what is tested.
        // Wrapped rather than subclassed, because BCryptPasswordEncoder's matches() is final.
        PasswordEncoder encoder = new PasswordEncoder() {
            @Override
            public String encode(CharSequence raw) {
                return bcrypt.encode(raw);
            }

            @Override
            public boolean matches(CharSequence raw, String encoded) {
                hashesChecked.add(encoded);
                return bcrypt.matches(raw, encoded);
            }
        };
        UserRepository nobodyHasAnAccount = (UserRepository) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] {UserRepository.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("findByEmailIgnoreCase")) {
                        return Optional.empty();
                    }
                    throw new UnsupportedOperationException(method.getName());
                });
        UserController controller = new UserController(nobodyHasAnAccount, encoder);

        ResponseEntity<?> response = controller.login(new LoginRequest("ghost@example.com", "hunter22"), null, null);

        assertEquals(401, response.getStatusCode().value());
        assertEquals(1, hashesChecked.size(), "the password should have been checked once, against the decoy");
        assertTrue(hashesChecked.get(0).startsWith("$2"), "the decoy should be a real bcrypt hash: " + hashesChecked.get(0));
    }
}
