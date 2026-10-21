package com.voyager.backend.trip;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;

// Runs the real server on a random port. Every person in a test is a separate signed-in client with
// their own cookie jar, which is the only way to check rules like "owners can, members cannot".

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class TripFlowTests {

    private static final String TRIP_BODY = "{\"name\":\"Great Ocean Road\",\"destination\":\"Victoria\"}";

    @Autowired
    private Environment environment;

    private String base;

    @BeforeEach
    void setUp() {
        base = "http://localhost:" + environment.getProperty("local.server.port");
    }

    /* A signed-in person */

    private final class Person {
        final HttpClient client = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .cookieHandler(new CookieManager())
                .build();
        final String id;

        // register=false gives someone who is not signed in.
        Person(String displayName, boolean register) throws Exception {
            if (register) {
                String email = "p-" + UUID.randomUUID() + "@example.com";
                HttpResponse<String> response = post("/api/auth/register",
                        "{\"displayName\":\"" + displayName + "\",\"email\":\"" + email + "\",\"password\":\"hunter22\"}");
                assertEquals(201, response.statusCode(), response.body());
                id = field(response.body(), "id");
            } else {
                id = null;
            }
        }

        HttpResponse<String> send(String method, String path, String json) throws Exception {
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(base + path));
            if (json == null) {
                builder.method(method, HttpRequest.BodyPublishers.noBody());
            } else {
                builder.header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(json));
            }
            return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        }

        HttpResponse<String> get(String path) throws Exception { return send("GET", path, null); }
        HttpResponse<String> post(String path, String json) throws Exception { return send("POST", path, json); }
        HttpResponse<String> patch(String path, String json) throws Exception { return send("PATCH", path, json); }
        HttpResponse<String> delete(String path) throws Exception { return send("DELETE", path, null); }
    }

    private Person person(String displayName) throws Exception {
        return new Person(displayName, true);
    }

    // The first value of a string field in a JSON body. Enough for these flat responses, and it keeps
    // the tests free of a JSON library.
    private static String field(String json, String name) {
        Matcher matcher = Pattern.compile("\"" + name + "\":\"([^\"]*)\"").matcher(json);
        assertTrue(matcher.find(), "no \"" + name + "\" in " + json);
        return matcher.group(1);
    }

    private static int count(String text, String part) {
        int found = 0;
        for (int at = text.indexOf(part); at >= 0; at = text.indexOf(part, at + part.length())) {
            found++;
        }
        return found;
    }

    private static String code(HttpResponse<String> response) {
        return field(response.body(), "code");
    }

    // Creates a trip as this person and returns its id.
    private String createTrip(Person owner) throws Exception {
        HttpResponse<String> response = owner.post("/api/trips", TRIP_BODY);
        assertEquals(201, response.statusCode(), response.body());
        return field(response.body(), "id");
    }

    // Runs these at the same moment, each on its own thread, and returns what each one got back.
    private static <T> List<T> together(List<Callable<T>> actions) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(actions.size());
        try {
            CountDownLatch ready = new CountDownLatch(actions.size());
            CountDownLatch go = new CountDownLatch(1);
            List<Future<T>> pending = new ArrayList<>();
            for (Callable<T> action : actions) {
                pending.add(pool.submit(() -> {
                    ready.countDown();
                    go.await();
                    return action.call();
                }));
            }
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            go.countDown();
            List<T> results = new ArrayList<>();
            for (Future<T> one : pending) {
                results.add(one.get(20, TimeUnit.SECONDS));
            }
            return results;
        } finally {
            pool.shutdownNow();
        }
    }

    private String inviteCode(Person member, String tripId) throws Exception {
        return field(member.get("/api/trips/" + tripId).body(), "inviteCode");
    }

    /* Creating and reading */

    @Test
    void creatingATripMakesTheCreatorItsOwnerAndFillsInTheDefaults() throws Exception {
        Person priya = person("Priya");

        HttpResponse<String> response = priya.post("/api/trips",
                "{\"name\":\" Great Ocean Road \",\"destination\":\" Victoria \","
                        + "\"startDate\":\"2026-11-08T00:00:00.000Z\",\"endDate\":\"2026-11-15T00:00:00.000Z\","
                        + "\"budgetCapCents\":250000}");

        assertEquals(201, response.statusCode(), response.body());
        String body = response.body();
        assertTrue(body.contains("\"name\":\"Great Ocean Road\""), body);
        assertTrue(body.contains("\"destination\":\"Victoria\""), body);
        assertTrue(body.contains("\"createdBy\":\"" + priya.id + "\""), body);
        assertTrue(body.contains("\"currency\":\"AUD\""), body);
        assertTrue(body.contains("\"allowanceCents\":25000"), body);
        assertTrue(body.contains("\"defaultPricePerLitreCents\":195"), body);
        assertTrue(body.contains("\"privateDebts\":true"), body);
        assertTrue(body.contains("\"budgetCapCents\":250000"), body);
        assertTrue(body.contains("\"startDate\":\"2026-11-08T00:00:00"), body);
        assertTrue(field(body, "inviteCode").matches("[A-HJ-NP-Z2-9]{6}"), body);

        String tripId = field(body, "id");
        HttpResponse<String> members = priya.get("/api/trips/" + tripId + "/members");
        assertEquals(200, members.statusCode(), members.body());
        assertEquals(1, count(members.body(), "\"role\":"));
        assertTrue(members.body().contains("\"role\":\"owner\""), members.body());
        assertTrue(members.body().contains("\"displayName\":\"Priya\""), members.body());
        assertFalse(members.body().contains("@"), "another person's email must not be sent: " + members.body());

        assertTrue(priya.get("/api/trips").body().contains("\"id\":\"" + tripId + "\""));
        assertEquals(200, priya.get("/api/trips/" + tripId).statusCode());
    }

    @Test
    void aTripWithNoDestinationOrDatesIsFine() throws Exception {
        HttpResponse<String> response = person("Priya").post("/api/trips", "{\"name\":\"Somewhere\"}");

        assertEquals(201, response.statusCode(), response.body());
        assertTrue(response.body().contains("\"destination\":\"\""), response.body());
        assertTrue(response.body().contains("\"startDate\":null"), response.body());
    }

    @Test
    void badTripsAreRefusedWithAMessageToShow() throws Exception {
        Person priya = person("Priya");

        HttpResponse<String> noName = priya.post("/api/trips", "{\"name\":\"   \"}");
        assertEquals(400, noName.statusCode());
        assertEquals("invalid", code(noName));
        assertTrue(noName.body().contains("Give the trip a name."), noName.body());

        assertEquals(400, priya.post("/api/trips", "{\"destination\":\"Victoria\"}").statusCode());
        assertEquals(400, priya.post("/api/trips",
                "{\"name\":\"X\",\"startDate\":\"2026-11-15T00:00:00Z\",\"endDate\":\"2026-11-08T00:00:00Z\"}").statusCode());
        assertEquals(400, priya.post("/api/trips", "{\"name\":\"X\",\"budgetCapCents\":-1}").statusCode());
        // Not JSON at all: still a 400 in the standard shape, never a server error.
        HttpResponse<String> garbage = priya.post("/api/trips", "{nope");
        assertEquals(400, garbage.statusCode());
        assertEquals("invalid", code(garbage));
    }

    @Test
    void textThatIsTooLongIsRefusedWithAMessageToShowNotAClash() throws Exception {
        Person priya = person("Priya");
        String hundred = "n".repeat(100);
        String tooLong = "n".repeat(101);

        HttpResponse<String> longName = priya.post("/api/trips", "{\"name\":\"" + tooLong + "\"}");
        assertEquals(400, longName.statusCode(), longName.body());
        assertEquals("invalid", code(longName));
        assertTrue(longName.body().contains("too long"), longName.body());
        HttpResponse<String> longPlace = priya.post("/api/trips", "{\"name\":\"X\",\"destination\":\"" + tooLong + "\"}");
        assertEquals(400, longPlace.statusCode(), longPlace.body());
        assertEquals("invalid", code(longPlace));

        // Exactly at the limit is fine.
        HttpResponse<String> atLimit = priya.post("/api/trips", "{\"name\":\"" + hundred + "\",\"destination\":\"" + hundred + "\"}");
        assertEquals(201, atLimit.statusCode(), atLimit.body());
        String tripId = field(atLimit.body(), "id");

        // The same limits apply when editing, and a refused edit changes nothing.
        HttpResponse<String> renamed = priya.patch("/api/trips/" + tripId, "{\"name\":\"" + tooLong + "\"}");
        assertEquals(400, renamed.statusCode(), renamed.body());
        assertEquals("invalid", code(renamed));
        assertEquals(400, priya.patch("/api/trips/" + tripId, "{\"destination\":\"" + tooLong + "\"}").statusCode());
        assertTrue(priya.get("/api/trips/" + tripId).body().contains("\"name\":\"" + hundred + "\""));
    }

    @Test
    void aTripIsInvisibleToPeopleWhoAreNotOnIt() throws Exception {
        Person priya = person("Priya");
        Person stranger = person("Stranger");
        String tripId = createTrip(priya);

        HttpResponse<String> get = stranger.get("/api/trips/" + tripId);
        assertEquals(404, get.statusCode());
        assertEquals("not_found", code(get));
        assertEquals(404, stranger.patch("/api/trips/" + tripId, "{\"privateDebts\":false}").statusCode());
        assertEquals(404, stranger.get("/api/trips/" + tripId + "/members").statusCode());
        assertEquals(404, stranger.post("/api/trips/" + tripId + "/regenerate-code", null).statusCode());
        assertEquals(404, stranger.delete("/api/trips/" + tripId + "/members/" + priya.id).statusCode());

        assertEquals("[]", stranger.get("/api/trips").body());
        // An id that is not even a UUID can never match anything.
        assertEquals(404, stranger.get("/api/trips/not-a-uuid").statusCode());
    }

    @Test
    void signedOutRequestsGetA401() throws Exception {
        Person nobody = new Person("Nobody", false);

        assertEquals(401, nobody.get("/api/trips").statusCode());
        assertEquals(401, nobody.post("/api/trips", TRIP_BODY).statusCode());
        assertEquals(401, nobody.get("/api/trips/preview/ABCDEF").statusCode());
        assertEquals(401, nobody.post("/api/trips/join/ABCDEF", null).statusCode());
    }

    /* Invite codes */

    @Test
    void anInviteCodeLetsSomeoneLookAtTheTripAndJoinIt() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        String tripId = createTrip(priya);
        String code = inviteCode(priya, tripId);

        HttpResponse<String> preview = jonas.get("/api/trips/preview/" + code.toLowerCase());
        assertEquals(200, preview.statusCode(), preview.body());
        assertTrue(preview.body().contains("\"name\":\"Great Ocean Road\""), preview.body());
        assertTrue(preview.body().contains("\"displayName\":\"Priya\""), preview.body());
        assertFalse(preview.body().contains("@"), "a preview must not carry email addresses: " + preview.body());
        assertFalse(preview.body().contains("inviteCode"), preview.body());
        assertFalse(preview.body().contains("allowanceCents"), "a preview is not for settings: " + preview.body());
        // Looking is not joining.
        assertEquals("[]", jonas.get("/api/trips").body());

        HttpResponse<String> join = jonas.post("/api/trips/join/" + code.toLowerCase(), null);
        assertEquals(200, join.statusCode(), join.body());
        assertEquals(tripId, field(join.body(), "id"));
        assertTrue(jonas.get("/api/trips").body().contains(tripId));

        // Joining again changes nothing.
        assertEquals(200, jonas.post("/api/trips/join/" + code, null).statusCode());
        HttpResponse<String> members = priya.get("/api/trips/" + tripId + "/members");
        assertEquals(2, count(members.body(), "\"role\":"), members.body());
        assertTrue(members.body().contains("\"role\":\"member\""), members.body());
    }

    @Test
    void aCodeThatMatchesNothingIsA404() throws Exception {
        Person jonas = person("Jonas");

        HttpResponse<String> preview = jonas.get("/api/trips/preview/ZZZZZZ");
        assertEquals(404, preview.statusCode());
        assertEquals("not_found", code(preview));
        assertEquals(404, jonas.post("/api/trips/join/ZZZZZZ", null).statusCode());
    }

    @Test
    void onlyTheOwnerCanMakeANewCodeAndTheOldOneStopsWorking() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        String tripId = createTrip(priya);
        String oldCode = inviteCode(priya, tripId);
        jonas.post("/api/trips/join/" + oldCode, null);

        HttpResponse<String> byMember = jonas.post("/api/trips/" + tripId + "/regenerate-code", null);
        assertEquals(403, byMember.statusCode());
        assertEquals("forbidden", code(byMember));
        assertEquals(oldCode, inviteCode(priya, tripId));

        HttpResponse<String> byOwner = priya.post("/api/trips/" + tripId + "/regenerate-code", null);
        assertEquals(200, byOwner.statusCode(), byOwner.body());
        String newCode = field(byOwner.body(), "inviteCode");
        assertNotEquals(oldCode, newCode);
        assertTrue(newCode.matches("[A-HJ-NP-Z2-9]{6}"), newCode);

        assertEquals(404, person("Late").get("/api/trips/preview/" + oldCode).statusCode());
        assertEquals(200, person("Early").get("/api/trips/preview/" + newCode).statusCode());
    }

    /* Changing a trip */

    @Test
    void anyMemberCanChangeTheSharedSettingsButOnlyTheOwnerCanRenameOrRedate() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        String tripId = createTrip(priya);
        jonas.post("/api/trips/join/" + inviteCode(priya, tripId), null);
        String path = "/api/trips/" + tripId;

        HttpResponse<String> toggle = jonas.patch(path, "{\"privateDebts\":false}");
        assertEquals(200, toggle.statusCode(), toggle.body());
        assertTrue(toggle.body().contains("\"privateDebts\":false"), toggle.body());
        assertEquals(200, jonas.patch(path, "{\"allowanceCents\":30000,\"defaultEfficiency\":7.5,\"defaultPricePerLitreCents\":210}").statusCode());

        for (String ownerOnly : new String[] {
                "{\"name\":\"Mine now\"}", "{\"destination\":\"Elsewhere\"}", "{\"startDate\":null}",
                "{\"currency\":\"USD\"}", "{\"budgetCapCents\":1}" }) {
            HttpResponse<String> refused = jonas.patch(path, ownerOnly);
            assertEquals(403, refused.statusCode(), ownerOnly);
            assertEquals("forbidden", code(refused));
        }

        HttpResponse<String> rename = priya.patch(path, "{\"name\":\"Road trip\",\"destination\":\"Torquay\"}");
        assertEquals(200, rename.statusCode(), rename.body());
        assertTrue(rename.body().contains("\"name\":\"Road trip\""), rename.body());
        assertTrue(rename.body().contains("\"destination\":\"Torquay\""), rename.body());
        // The earlier shared-settings change is still there.
        assertTrue(rename.body().contains("\"privateDebts\":false"), rename.body());
        assertTrue(rename.body().contains("\"allowanceCents\":30000"), rename.body());
        assertTrue(rename.body().contains("\"defaultEfficiency\":7.5"), rename.body());
    }

    @Test
    void theInviteCodeAndOwnerCannotBeChangedThroughAnUpdate() throws Exception {
        Person priya = person("Priya");
        String tripId = createTrip(priya);
        String code = inviteCode(priya, tripId);

        HttpResponse<String> response = priya.patch("/api/trips/" + tripId,
                "{\"inviteCode\":\"AAAAAA\",\"createdBy\":\"" + UUID.randomUUID() + "\",\"id\":\"" + UUID.randomUUID() + "\"}");

        assertEquals(200, response.statusCode(), response.body());
        assertEquals(code, field(response.body(), "inviteCode"));
        assertEquals(priya.id, field(response.body(), "createdBy"));
        assertEquals(tripId, field(response.body(), "id"));
    }

    @Test
    void anUpdateCanClearDatesAndBadValuesChangeNothing() throws Exception {
        Person priya = person("Priya");
        String tripId = createTrip(priya);
        String path = "/api/trips/" + tripId;
        assertEquals(200, priya.patch(path, "{\"startDate\":\"2026-11-08T00:00:00Z\",\"endDate\":\"2026-11-15T00:00:00Z\"}").statusCode());

        HttpResponse<String> cleared = priya.patch(path, "{\"startDate\":null,\"endDate\":null,\"budgetCapCents\":null}");
        assertEquals(200, cleared.statusCode(), cleared.body());
        assertTrue(cleared.body().contains("\"startDate\":null"), cleared.body());
        assertTrue(cleared.body().contains("\"endDate\":null"), cleared.body());

        String[] bad = {
                "{\"name\":\"  \"}",
                "{\"startDate\":\"next tuesday\"}",
                "{\"startDate\":5}",
                "{\"startDate\":\"2026-12-01T00:00:00Z\",\"endDate\":\"2026-11-01T00:00:00Z\"}",
                "{\"allowanceCents\":12.5}",
                "{\"allowanceCents\":-1}",
                "{\"allowanceCents\":\"lots\"}",
                "{\"defaultEfficiency\":0}",
                "{\"defaultPricePerLitreCents\":-5}",
                "{\"privateDebts\":\"yes\"}",
                "{\"currency\":\"dollars\"}",
        };
        for (String body : bad) {
            HttpResponse<String> refused = priya.patch(path, body);
            assertEquals(400, refused.statusCode(), body + " -> " + refused.body());
            assertEquals("invalid", code(refused), body);
        }

        // A patch with one good field and one bad one is refused as a whole: the good one is not kept.
        assertEquals(400, priya.patch(path, "{\"name\":\"Changed\",\"allowanceCents\":-1}").statusCode());
        assertEquals("Great Ocean Road", field(priya.get(path).body(), "name"));
    }

    /* Members */

    @Test
    void aMemberCanLeaveAndRejoinAndAnOwnerCanRemoveOthersButMembersCannot() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        Person mia = person("Mia");
        String tripId = createTrip(priya);
        String code = inviteCode(priya, tripId);
        jonas.post("/api/trips/join/" + code, null);
        mia.post("/api/trips/join/" + code, null);
        String members = "/api/trips/" + tripId + "/members/";

        // A member cannot remove someone else.
        HttpResponse<String> refused = jonas.delete(members + mia.id);
        assertEquals(403, refused.statusCode());
        assertEquals("forbidden", code(refused));

        // But can leave, which takes the trip off their list and out of their reach.
        assertEquals(204, jonas.delete(members + jonas.id).statusCode());
        assertEquals("[]", jonas.get("/api/trips").body());
        assertEquals(404, jonas.get("/api/trips/" + tripId).statusCode());
        assertEquals(2, count(priya.get("/api/trips/" + tripId + "/members").body(), "\"role\":"));

        // They can come back with the code.
        assertEquals(200, jonas.post("/api/trips/join/" + code, null).statusCode());
        assertEquals(3, count(priya.get("/api/trips/" + tripId + "/members").body(), "\"role\":"));

        // The owner can remove someone.
        assertEquals(204, priya.delete(members + mia.id).statusCode());
        assertEquals(404, mia.get("/api/trips/" + tripId).statusCode());
        // Someone who is not on the trip cannot be removed from it.
        assertEquals(404, priya.delete(members + mia.id).statusCode());
        assertEquals(404, priya.delete(members + UUID.randomUUID()).statusCode());
    }

    @Test
    void aTripAlwaysKeepsAnOwner() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        String tripId = createTrip(priya);
        jonas.post("/api/trips/join/" + inviteCode(priya, tripId), null);
        String path = "/api/trips/" + tripId + "/members/";

        HttpResponse<String> leave = priya.delete(path + priya.id);
        assertEquals(403, leave.statusCode());
        assertTrue(leave.body().contains("A trip needs an owner."), leave.body());
        HttpResponse<String> demote = priya.patch(path + priya.id, "{\"role\":\"member\"}");
        assertEquals(403, demote.statusCode());
        assertTrue(demote.body().contains("A trip needs an owner."), demote.body());
        assertEquals(2, count(priya.get("/api/trips/" + tripId + "/members").body(), "\"role\":"));
    }

    @Test
    void ownersCanHandOverTheTripAndThenLeave() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        String tripId = createTrip(priya);
        jonas.post("/api/trips/join/" + inviteCode(priya, tripId), null);
        String path = "/api/trips/" + tripId + "/members/";

        // A member cannot promote anyone, themselves included.
        HttpResponse<String> byMember = jonas.patch(path + jonas.id, "{\"role\":\"owner\"}");
        assertEquals(403, byMember.statusCode());
        assertEquals("forbidden", code(byMember));

        assertEquals(400, priya.patch(path + jonas.id, "{\"role\":\"boss\"}").statusCode());
        assertEquals(400, priya.patch(path + jonas.id, "{}").statusCode());
        assertEquals(404, priya.patch(path + UUID.randomUUID(), "{\"role\":\"owner\"}").statusCode());

        assertEquals(204, priya.patch(path + jonas.id, "{\"role\":\"owner\"}").statusCode());
        assertEquals(2, count(priya.get("/api/trips/" + tripId + "/members").body(), "\"role\":\"owner\""));

        // With a second owner the first can leave, and the trip carries on with the new one.
        assertEquals(204, priya.delete(path + priya.id).statusCode());
        assertEquals(404, priya.get("/api/trips/" + tripId).statusCode());
        assertEquals(200, jonas.get("/api/trips/" + tripId).statusCode());
        assertEquals(1, count(jonas.get("/api/trips/" + tripId + "/members").body(), "\"role\":\"owner\""));

        // The last owner cannot step back to a member either.
        assertEquals(403, jonas.patch(path + jonas.id, "{\"role\":\"member\"}").statusCode());
    }

    /* Two requests at the same moment */

    @Test
    void joiningTwiceAtTheSameMomentAddsThePersonOnce() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        String tripId = createTrip(priya);
        String code = inviteCode(priya, tripId);

        List<Integer> statuses = together(List.of(
                () -> jonas.post("/api/trips/join/" + code, null).statusCode(),
                () -> jonas.post("/api/trips/join/" + code, null).statusCode(),
                () -> jonas.post("/api/trips/join/" + code, null).statusCode(),
                () -> jonas.post("/api/trips/join/" + code, null).statusCode()));

        assertEquals(List.of(200, 200, 200, 200), statuses);
        assertEquals(2, count(priya.get("/api/trips/" + tripId + "/members").body(), "\"role\":"));
    }

    @Test
    void twoOwnersLeavingAtTheSameMomentCannotLeaveATripWithNoOwner() throws Exception {
        for (int round = 0; round < 6; round++) {
            Person priya = person("Priya");
            Person jonas = person("Jonas");
            String tripId = createTrip(priya);
            jonas.post("/api/trips/join/" + inviteCode(priya, tripId), null);
            String path = "/api/trips/" + tripId + "/members/";
            assertEquals(204, priya.patch(path + jonas.id, "{\"role\":\"owner\"}").statusCode());

            List<Integer> statuses = together(List.of(
                    () -> priya.delete(path + priya.id).statusCode(),
                    () -> jonas.delete(path + jonas.id).statusCode()));

            // One got out. The other was told the trip needs an owner. Never both out.
            assertTrue(statuses.contains(204) && statuses.contains(403), "round " + round + ": " + statuses);
            Person stayer = priya.get("/api/trips/" + tripId).statusCode() == 200 ? priya : jonas;
            assertEquals(200, stayer.get("/api/trips/" + tripId).statusCode());
            assertEquals(1, count(stayer.get("/api/trips/" + tripId + "/members").body(), "\"role\":\"owner\""));
        }
    }

    @Test
    void twoOwnersStepDownFromEachOtherAtTheSameMomentAndOneStaysOwner() throws Exception {
        for (int round = 0; round < 6; round++) {
            Person priya = person("Priya");
            Person jonas = person("Jonas");
            String tripId = createTrip(priya);
            jonas.post("/api/trips/join/" + inviteCode(priya, tripId), null);
            String path = "/api/trips/" + tripId + "/members/";
            assertEquals(204, priya.patch(path + jonas.id, "{\"role\":\"owner\"}").statusCode());

            List<Integer> statuses = together(List.of(
                    () -> priya.patch(path + jonas.id, "{\"role\":\"member\"}").statusCode(),
                    () -> jonas.patch(path + priya.id, "{\"role\":\"member\"}").statusCode()));

            // Whoever got in first demoted the other, so the second is no longer allowed to.
            assertTrue(statuses.contains(204) && statuses.contains(403), "round " + round + ": " + statuses);
            assertEquals(1, count(priya.get("/api/trips/" + tripId + "/members").body(), "\"role\":\"owner\""));
        }
    }
}
