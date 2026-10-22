package com.voyager.backend.expenses;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;

// Runs the real server on a random port. Every person is a separate signed-in client with their own
// cookie jar. The detailed rules are checked at service level; these check them over HTTP: who can
// see, add, change and delete expenses, how splits are sent and come back, what a bad request is
// answered with, and what happens to a person's expenses when they leave.

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ExpenseFlowTests {

    private static final String TRIP_BODY = "{\"name\":\"Great Ocean Road\",\"destination\":\"Victoria\"}";
    private static final String DAY = "2030-06-15T12:00:00.000Z";

    @Autowired
    private Environment environment;

    private String base;

    @BeforeEach
    void setUp() {
        base = "http://localhost:" + environment.getProperty("local.server.port");
    }

    private final class Person {
        final HttpClient client = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .cookieHandler(new CookieManager())
                .build();
        final String id;

        // register=false gives someone who is not signed in.
        Person(String displayName, boolean register) throws Exception {
            if (register) {
                HttpResponse<String> response = send("POST", "/api/auth/register",
                        "{\"displayName\":\"" + displayName + "\",\"email\":\"x-" + UUID.randomUUID()
                                + "@example.com\",\"password\":\"hunter22\"}");
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

    private static String field(String json, String name) {
        Matcher matcher = Pattern.compile("\"" + name + "\":\"([^\"]*)\"").matcher(json);
        assertTrue(matcher.find(), "no \"" + name + "\" in " + json);
        return matcher.group(1);
    }

    // A trip with this many people on it: the first is the owner.
    private record Group(String tripId, String code, List<Person> people) {
        Person owner() { return people.get(0); }
    }

    private Group group(int size) throws Exception {
        List<Person> people = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            people.add(new Person("Person" + i, true));
        }
        HttpResponse<String> created = people.get(0).post("/api/trips", TRIP_BODY);
        assertEquals(201, created.statusCode(), created.body());
        String tripId = field(created.body(), "id");
        String code = field(created.body(), "inviteCode");
        for (int i = 1; i < size; i++) {
            assertEquals(200, people.get(i).post("/api/trips/join/" + code, null).statusCode());
        }
        return new Group(tripId, code, people);
    }

    private static String ids(String... ids) {
        List<String> quoted = new ArrayList<>();
        for (String id : ids) {
            quoted.add("\"" + id + "\"");
        }
        return String.join(",", quoted);
    }

    private static String equalSplit(String... ids) {
        return "{\"kind\":\"equal\",\"userIds\":[" + ids(ids) + "]}";
    }

    // pairs of person id and cents
    private static String exactSplit(Object... pairs) {
        List<String> parts = new ArrayList<>();
        for (int i = 0; i < pairs.length; i += 2) {
            parts.add("\"" + pairs[i] + "\":" + pairs[i + 1]);
        }
        return "{\"kind\":\"exact\",\"amounts\":{" + String.join(",", parts) + "}}";
    }

    private static String body(String description, Object cents, String paidBy, String spentAt, String split) {
        return "{\"description\":\"" + description + "\",\"amountCents\":" + cents + ",\"paidBy\":\"" + paidBy
                + "\",\"spentAt\":\"" + spentAt + "\",\"category\":\"food\",\"split\":" + split + "}";
    }

    private String add(Person by, String tripId, String json) throws Exception {
        HttpResponse<String> response = by.post("/api/trips/" + tripId + "/expenses", json);
        assertEquals(201, response.statusCode(), response.body());
        return field(response.body(), "id");
    }

    private String list(Person viewer, String tripId) throws Exception {
        HttpResponse<String> response = viewer.get("/api/trips/" + tripId + "/expenses");
        assertEquals(200, response.statusCode(), response.body());
        return response.body();
    }

    private boolean listed(Person viewer, String tripId, String expenseId) throws Exception {
        return list(viewer, tripId).contains("\"id\":\"" + expenseId + "\"");
    }

    @Test
    void everyoneOnTheTripSeesEveryExpenseAndNobodyElseSeesAny() throws Exception {
        Group g = group(3);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2);
        Person stranger = new Person("Sam", true);
        Person signedOut = new Person("", false);

        HttpResponse<String> created = jonas.post("/api/trips/" + g.tripId() + "/expenses",
                body("Groceries", 12345, mia.id, DAY, "null"));
        assertEquals(201, created.statusCode(), created.body());
        String e = created.body();
        assertEquals("Groceries", field(e, "description"));
        assertTrue(e.contains("\"amountCents\":12345"), e);
        assertEquals(mia.id, field(e, "paidBy"));
        assertEquals(jonas.id, field(e, "createdBy"));
        assertEquals(g.tripId(), field(e, "tripId"));
        assertEquals("food", field(e, "category"));
        assertEquals("manual", field(e, "source"));
        assertTrue(e.contains("\"sourceId\":null"), e);
        assertTrue(e.contains("\"split\":null"), e);
        String id = field(e, "id");

        assertTrue(listed(priya, g.tripId(), id));
        assertTrue(listed(mia, g.tripId(), id));

        assertEquals(404, stranger.get("/api/trips/" + g.tripId() + "/expenses").statusCode());
        assertEquals(404, stranger.post("/api/trips/" + g.tripId() + "/expenses", body("x", 100, priya.id, DAY, "null")).statusCode());
        assertEquals(401, signedOut.get("/api/trips/" + g.tripId() + "/expenses").statusCode());
        assertEquals(404, priya.get("/api/trips/" + UUID.randomUUID() + "/expenses").statusCode());
    }

    @Test
    void newestSpendingComesFirst() throws Exception {
        Group g = group(2);
        Person priya = g.owner();
        String oldest = add(priya, g.tripId(), body("Oldest", 100, priya.id, "2030-06-10T12:00:00Z", "null"));
        String newest = add(priya, g.tripId(), body("Newest", 100, priya.id, "2030-06-20T12:00:00Z", "null"));
        String middle = add(priya, g.tripId(), body("Middle", 100, priya.id, "2030-06-15T12:00:00Z", "null"));
        String all = list(priya, g.tripId());
        int a = all.indexOf(newest), b = all.indexOf(middle), c = all.indexOf(oldest);
        assertTrue(a >= 0 && a < b && b < c, all);
    }

    @Test
    void aBadRequestIsRefusedWithAMessage() throws Exception {
        Group g = group(2);
        Person priya = g.owner(), jonas = g.people().get(1);
        Person stranger = new Person("Sam", true);
        String url = "/api/trips/" + g.tripId() + "/expenses";

        for (String bad : List.of(
                body("   ", 100, priya.id, DAY, "null"),
                body("x".repeat(101), 100, priya.id, DAY, "null"),
                body("x", 0, priya.id, DAY, "null"),
                body("x", -5, priya.id, DAY, "null"),
                body("x", 12.5, priya.id, DAY, "null"),
                body("x", "\"500\"", priya.id, DAY, "null"),
                body("x", 10_000_000_001L, priya.id, DAY, "null"),
                body("x", 100, UUID.randomUUID().toString(), DAY, "null"),
                body("x", 100, stranger.id, DAY, "null"),
                body("x", 100, priya.id, "yesterday", "null"),
                body("x", 100, priya.id, DAY, "\"equal\""),
                body("x", 100, priya.id, DAY, "{\"kind\":\"thirds\"}"),
                body("x", 100, priya.id, DAY, equalSplit()),
                body("x", 100, priya.id, DAY, equalSplit(stranger.id)),
                body("x", 100, priya.id, DAY, exactSplit(jonas.id, 101)),
                body("x", 100, priya.id, DAY, exactSplit(jonas.id, -1)),
                body("x", 100, priya.id, DAY, exactSplit(jonas.id, 0)),
                body("x", 100, priya.id, DAY, exactSplit(stranger.id, 10)),
                body("x", 100, priya.id, DAY, exactSplit(jonas.id, 5.5)),
                body("x", 100, priya.id, DAY, exactSplit()))) {
            HttpResponse<String> response = priya.post(url, bad);
            assertEquals(400, response.statusCode(), bad + " -> " + response.body());
            assertEquals("invalid", field(response.body(), "code"), response.body());
            assertFalse(field(response.body(), "message").isBlank());
        }
        // Not JSON at all, and JSON that is not an object.
        assertEquals(400, priya.post(url, "{nope").statusCode());
        assertEquals(400, priya.post(url, "[]").statusCode());
        assertEquals("[]", list(priya, g.tripId()), "refused requests added nothing");
    }

    @Test
    void splitsGoInAndComeBackInTheSameShape() throws Exception {
        Group g = group(3);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2);

        HttpResponse<String> equal = priya.post("/api/trips/" + g.tripId() + "/expenses",
                body("Pizza", 3000, priya.id, DAY, equalSplit(jonas.id, mia.id, mia.id)));
        assertEquals(201, equal.statusCode(), equal.body());
        assertTrue(equal.body().contains("\"kind\":\"equal\""), equal.body());
        assertTrue(equal.body().contains(jonas.id) && equal.body().contains(mia.id), equal.body());
        assertFalse(equal.body().contains("\"amounts\""), equal.body());
        assertEquals(1, equal.body().split(Pattern.quote(mia.id), -1).length - 1, "named twice, listed once");

        // A zero and the payer's own figure are dropped.
        HttpResponse<String> exact = priya.post("/api/trips/" + g.tripId() + "/expenses",
                body("Tickets", 5000, priya.id, DAY, exactSplit(jonas.id, 1500, mia.id, 0, priya.id, 900)));
        assertEquals(201, exact.statusCode(), exact.body());
        assertTrue(exact.body().contains("\"kind\":\"exact\""), exact.body());
        assertTrue(exact.body().contains("\"" + jonas.id + "\":1500"), exact.body());
        assertFalse(exact.body().contains("\"" + mia.id + "\":"), exact.body());
        assertFalse(exact.body().contains("\"" + priya.id + "\":"), exact.body());
        assertFalse(exact.body().contains("\"userIds\""), exact.body());

        // The list gives the same.
        String all = list(mia, g.tripId());
        assertTrue(all.contains("\"kind\":\"equal\"") && all.contains("\"kind\":\"exact\""), all);
    }

    @Test
    void whoCanChangeAndDelete() throws Exception {
        Group g = group(4);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2), cara = g.people().get(3);
        Person stranger = new Person("Sam", true);
        // Jonas typed it in; Mia paid.
        String id = add(jonas, g.tripId(), body("Dinner", 6000, mia.id, DAY, "null"));
        String path = "/api/expenses/" + id;

        HttpResponse<String> refused = cara.patch(path, "{\"description\":\"Hijack\"}");
        assertEquals(403, refused.statusCode(), refused.body());
        assertEquals("forbidden", field(refused.body(), "code"));
        assertEquals(403, cara.delete(path).statusCode());
        assertTrue(listed(cara, g.tripId(), id));
        assertEquals(404, stranger.patch(path, "{\"description\":\"x\"}").statusCode());
        assertEquals(404, stranger.delete(path).statusCode());

        // The person who typed it in, the person who paid, and the owner can all change it, and a
        // partial change leaves the rest alone.
        HttpResponse<String> changed = jonas.patch(path, "{\"description\":\"Dinner out\"}");
        assertEquals(200, changed.statusCode(), changed.body());
        assertEquals("Dinner out", field(changed.body(), "description"));
        assertTrue(changed.body().contains("\"amountCents\":6000"), changed.body());
        assertEquals(mia.id, field(changed.body(), "paidBy"));
        assertEquals(200, mia.patch(path, "{\"category\":\"other\"}").statusCode());
        HttpResponse<String> byOwner = priya.patch(path, "{\"amountCents\":6500}");
        assertEquals(200, byOwner.statusCode(), byOwner.body());
        assertTrue(byOwner.body().contains("\"amountCents\":6500"), byOwner.body());
        // Fields that are not patchable are ignored.
        HttpResponse<String> ignored = jonas.patch(path, "{\"createdBy\":\"" + cara.id + "\",\"source\":\"fuel\"}");
        assertEquals(200, ignored.statusCode(), ignored.body());
        assertEquals(jonas.id, field(ignored.body(), "createdBy"));
        assertEquals("manual", field(ignored.body(), "source"));
        // A bad change is refused and changes nothing.
        assertEquals(400, jonas.patch(path, "{\"amountCents\":0}").statusCode());
        assertEquals(400, jonas.patch(path, "{\"paidBy\":\"" + stranger.id + "\"}").statusCode());
        assertTrue(list(jonas, g.tripId()).contains("\"amountCents\":6500"));

        // Whoever paid or typed it in can delete it, and so can the owner.
        assertEquals(204, mia.delete(path).statusCode());
        assertFalse(listed(priya, g.tripId(), id));
        assertEquals(404, mia.delete(path).statusCode());
        assertEquals(404, priya.patch(path, "{\"description\":\"x\"}").statusCode());
        String byJonas = add(jonas, g.tripId(), body("A", 100, cara.id, DAY, "null"));
        assertEquals(204, jonas.delete("/api/expenses/" + byJonas).statusCode());
        String viaOwner = add(jonas, g.tripId(), body("B", 100, cara.id, DAY, "null"));
        assertEquals(204, priya.delete("/api/expenses/" + viaOwner).statusCode());
    }

    @Test
    void aSplitIsCheckedAgainstTheExpenseWhenEitherChanges() throws Exception {
        Group g = group(3);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2);
        String id = add(priya, g.tripId(), body("Hire car", 10000, priya.id, DAY, exactSplit(jonas.id, 3000, mia.id, 2000)));
        String path = "/api/expenses/" + id;

        // Lowering the total below what is owed is refused, and the expense is left as it was.
        HttpResponse<String> tooLow = priya.patch(path, "{\"amountCents\":4000}");
        assertEquals(400, tooLow.statusCode(), tooLow.body());
        assertTrue(list(priya, g.tripId()).contains("\"amountCents\":10000"));
        assertEquals(200, priya.patch(path, "{\"amountCents\":5000}").statusCode());

        // A new split replaces the old one, even when it names the same people.
        HttpResponse<String> swapped = priya.patch(path, "{\"split\":" + equalSplit(jonas.id, priya.id) + "}");
        assertEquals(200, swapped.statusCode(), swapped.body());
        assertTrue(swapped.body().contains("\"kind\":\"equal\""), swapped.body());
        assertFalse(swapped.body().contains(mia.id), swapped.body());
        HttpResponse<String> back = priya.patch(path, "{\"split\":" + exactSplit(jonas.id, 100) + "}");
        assertEquals(200, back.statusCode(), back.body());
        assertTrue(back.body().contains("\"" + jonas.id + "\":100"), back.body());

        // null puts it back to everyone, evenly.
        HttpResponse<String> reset = priya.patch(path, "{\"split\":null}");
        assertEquals(200, reset.statusCode(), reset.body());
        assertTrue(reset.body().contains("\"split\":null"), reset.body());
    }

    @Test
    void whatSomeoneSpentOrOwesStaysWhenTheyLeave() throws Exception {
        Group g = group(3);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2);
        String paid = add(jonas, g.tripId(), body("Jonas paid", 9000, jonas.id, DAY, "null"));
        String owes = add(priya, g.tripId(), body("Jonas owes", 6000, priya.id, DAY, exactSplit(jonas.id, 2000)));

        assertEquals(204, jonas.delete("/api/trips/" + g.tripId() + "/members/" + jonas.id).statusCode());

        // Both are still there, still naming him, so the money still adds up.
        assertTrue(listed(priya, g.tripId(), paid));
        assertTrue(listed(mia, g.tripId(), owes));
        assertTrue(list(priya, g.tripId()).contains("\"" + jonas.id + "\":2000"));
        // He no longer reaches any of it.
        assertEquals(404, jonas.get("/api/trips/" + g.tripId() + "/expenses").statusCode());
        assertEquals(404, jonas.delete("/api/expenses/" + paid).statusCode());
        // Nobody can start naming him now that he is off the trip.
        assertEquals(400, priya.post("/api/trips/" + g.tripId() + "/expenses", body("x", 100, jonas.id, DAY, "null")).statusCode());
        assertEquals(400, priya.post("/api/trips/" + g.tripId() + "/expenses", body("x", 100, priya.id, DAY, equalSplit(jonas.id))).statusCode());
        // But what already names him can be edited without removing him.
        assertEquals(200, priya.patch("/api/expenses/" + owes, "{\"description\":\"Still owes\"}").statusCode());
        assertTrue(list(priya, g.tripId()).contains("\"" + jonas.id + "\":2000"));
    }
}
