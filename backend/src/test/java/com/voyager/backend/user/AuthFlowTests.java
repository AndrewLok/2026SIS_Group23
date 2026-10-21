package com.voyager.backend.user;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;

// Runs the real server on a random port and talks to it like a browser would: a cookie jar,
// JSON in, JSON out. Each test gets its own client, so nothing is signed in unless the test does it.

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AuthFlowTests {

    @Autowired
    private Environment environment;

    private HttpClient client;
    private String base;

    @BeforeEach
    void setUp() {
        client = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1) // Skip the JDK client's h2c upgrade attempt on plain HTTP.
                .cookieHandler(new CookieManager())
                .build();
        base = "http://localhost:" + environment.getProperty("local.server.port");
    }

    private HttpResponse<String> post(String path, String json) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(base + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> get(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(base + path)).GET().build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    // The email is unique per call because the in-memory database is shared by every test in the run.
    private static String uniqueEmail() {
        return "sam-" + UUID.randomUUID() + "@example.com";
    }

    private static String registerJson(String name, String email, String password) {
        return "{\"displayName\":\"" + name + "\",\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
    }

    private static String loginJson(String email, String password) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
    }

    @Test
    void registerCreatesTheAccountSignsInAndSetsAHardenedCookie() throws Exception {
        String email = uniqueEmail();

        HttpResponse<String> response = post("/api/auth/register", registerJson("Sam", email, "hunter22"));

        assertEquals(201, response.statusCode());
        assertTrue(response.body().contains("\"displayName\":\"Sam\""));
        assertTrue(response.body().contains("\"email\":\"" + email + "\""));
        assertTrue(response.body().contains("\"avatarHue\":"));
        assertFalse(response.body().toLowerCase().contains("password"), "the response must never carry a password or hash");

        String cookie = String.join("; ", response.headers().allValues("Set-Cookie"));
        assertTrue(cookie.contains("HttpOnly"), cookie);
        assertTrue(cookie.contains("SameSite=Lax"), cookie);

        // Registering signed us in, so /me works with no further login.
        HttpResponse<String> me = get("/api/auth/me");
        assertEquals(200, me.statusCode());
        assertTrue(me.body().contains("\"email\":\"" + email + "\""));
    }

    @Test
    void meAndOtherEndpointsNeedASession() throws Exception {
        assertEquals(401, get("/api/auth/me").statusCode());
        assertEquals(401, get("/api/trips").statusCode());
    }

    @Test
    void logoutEndsTheSession() throws Exception {
        post("/api/auth/register", registerJson("Sam", uniqueEmail(), "hunter22"));
        assertEquals(200, get("/api/auth/me").statusCode());

        assertEquals(204, post("/api/auth/logout", "{}").statusCode());

        assertEquals(401, get("/api/auth/me").statusCode());
        // Logging out when already signed out is not an error.
        assertEquals(204, post("/api/auth/logout", "{}").statusCode());
    }

    @Test
    void loginWorksCaseInsensitivelyAndWrongPasswordsAreRefused() throws Exception {
        String email = uniqueEmail();
        post("/api/auth/register", registerJson("Sam", email, "hunter22"));
        post("/api/auth/logout", "{}");

        HttpResponse<String> wrong = post("/api/auth/login", loginJson(email, "not-the-password"));
        assertEquals(401, wrong.statusCode());
        assertTrue(wrong.body().contains("\"code\":\"invalid_credentials\""), wrong.body());
        assertEquals(401, get("/api/auth/me").statusCode());

        HttpResponse<String> unknown = post("/api/auth/login", loginJson(uniqueEmail(), "hunter22"));
        assertEquals(401, unknown.statusCode());
        // Same answer as a wrong password, so nobody can use it to find out who has an account.
        assertEquals(wrong.body(), unknown.body());

        HttpResponse<String> ok = post("/api/auth/login", loginJson("  " + email.toUpperCase() + " ", "hunter22"));
        assertEquals(200, ok.statusCode());
        assertTrue(ok.body().contains("\"displayName\":\"Sam\""));
        assertEquals(200, get("/api/auth/me").statusCode());
    }

    @Test
    void loginIssuesANewSessionId() throws Exception {
        String email = uniqueEmail();
        String registered = String.join("; ", post("/api/auth/register", registerJson("Sam", email, "hunter22")).headers().allValues("Set-Cookie"));
        String loggedIn = String.join("; ", post("/api/auth/login", loginJson(email, "hunter22")).headers().allValues("Set-Cookie"));

        assertTrue(registered.contains("JSESSIONID="), registered);
        assertTrue(loggedIn.contains("JSESSIONID="), loggedIn);
        assertFalse(registered.equals(loggedIn), "logging in must not reuse the previous session id");
    }

    @Test
    void duplicateEmailIsAConflictEvenWithDifferentCase() throws Exception {
        String email = uniqueEmail();
        assertEquals(201, post("/api/auth/register", registerJson("Sam", email, "hunter22")).statusCode());

        HttpResponse<String> again = post("/api/auth/register", registerJson("Other Sam", email.toUpperCase(), "hunter22"));

        assertEquals(409, again.statusCode());
        assertTrue(again.body().contains("\"code\":\"conflict\""), again.body());
    }

    @Test
    void badSignUpsAreRefusedWithAMessageToShow() throws Exception {
        HttpResponse<String> noName = post("/api/auth/register", registerJson("  ", uniqueEmail(), "hunter22"));
        assertEquals(400, noName.statusCode());
        assertTrue(noName.body().contains("\"code\":\"invalid\""), noName.body());

        assertEquals(400, post("/api/auth/register", registerJson("Sam", "not-an-email", "hunter22")).statusCode());
        assertEquals(400, post("/api/auth/register", registerJson("Sam", uniqueEmail(), "short")).statusCode());
        assertEquals(400, post("/api/auth/register", registerJson("Sam", uniqueEmail(), "x".repeat(73))).statusCode());
        // A missing field is a 400, not a server error.
        assertEquals(400, post("/api/auth/register", "{\"email\":\"" + uniqueEmail() + "\"}").statusCode());
    }

    @Test
    void aNameOrEmailThatIsTooLongIsRefusedWithAMessageNotReportedAsAClash() throws Exception {
        String sixty = "n".repeat(60);

        HttpResponse<String> longName = post("/api/auth/register", registerJson("n".repeat(61), uniqueEmail(), "hunter22"));
        assertEquals(400, longName.statusCode(), longName.body());
        assertTrue(longName.body().contains("\"code\":\"invalid\""), longName.body());
        assertTrue(longName.body().contains("too long"), longName.body());
        assertFalse(longName.body().contains("already an account"), longName.body());

        // The limit counts the name as it will be saved, without the spaces around it.
        assertEquals(201, post("/api/auth/register", registerJson("  " + sixty + "  ", uniqueEmail(), "hunter22")).statusCode());

        String longEmail = "a".repeat(250) + "@example.com";
        HttpResponse<String> tooLongEmail = post("/api/auth/register", registerJson("Sam", longEmail, "hunter22"));
        assertEquals(400, tooLongEmail.statusCode(), tooLongEmail.body());
        assertTrue(tooLongEmail.body().contains("\"code\":\"invalid\""), tooLongEmail.body());
        assertFalse(tooLongEmail.body().contains("already an account"), tooLongEmail.body());
    }
}
