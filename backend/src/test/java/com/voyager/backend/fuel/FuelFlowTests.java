package com.voyager.backend.fuel;

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
// see, add, change and delete fuel legs, that each leg keeps an expense in step with it, what a bad
// request is answered with, and what happens to a person's legs when they leave.

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class FuelFlowTests {

    private static final String TRIP_BODY = "{\"name\":\"Great Ocean Road\",\"destination\":\"Victoria\"}";

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

    private static String leg(String label, Object km, Object efficiency, Object price, String driver, String... riders) {
        return "{\"label\":\"" + label + "\",\"distanceKm\":" + km + ",\"efficiencyL100km\":" + efficiency
                + ",\"pricePerLitreCents\":" + price + ",\"driverId\":\"" + driver + "\",\"riderIds\":[" + ids(riders) + "]}";
    }

    private String add(Person by, String tripId, String json) throws Exception {
        HttpResponse<String> response = by.post("/api/trips/" + tripId + "/fuel-legs", json);
        assertEquals(201, response.statusCode(), response.body());
        return field(response.body(), "id");
    }

    private String list(Person viewer, String tripId) throws Exception {
        HttpResponse<String> response = viewer.get("/api/trips/" + tripId + "/fuel-legs");
        assertEquals(200, response.statusCode(), response.body());
        return response.body();
    }

    private boolean listed(Person viewer, String tripId, String legId) throws Exception {
        return list(viewer, tripId).contains("\"id\":\"" + legId + "\"");
    }

    private String expenses(Person viewer, String tripId) throws Exception {
        HttpResponse<String> response = viewer.get("/api/trips/" + tripId + "/expenses");
        assertEquals(200, response.statusCode(), response.body());
        return response.body();
    }

    @Test
    void everyoneOnTheTripSeesEveryLegAndNobodyElseSeesAny() throws Exception {
        Group g = group(3);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2);
        Person stranger = new Person("Sam", true);
        Person signedOut = new Person("", false);

        HttpResponse<String> created = jonas.post("/api/trips/" + g.tripId() + "/fuel-legs",
                leg("Lorne to Apollo Bay", 100, 8, 200, mia.id, jonas.id, mia.id, priya.id));
        assertEquals(201, created.statusCode(), created.body());
        String l = created.body();
        assertEquals("Lorne to Apollo Bay", field(l, "label"));
        assertTrue(l.contains("\"distanceKm\":100.0"), l);
        assertTrue(l.contains("\"efficiencyL100km\":8.0"), l);
        assertTrue(l.contains("\"pricePerLitreCents\":200"), l);
        assertEquals(mia.id, field(l, "driverId"));
        assertEquals(jonas.id, field(l, "createdBy"));
        assertEquals(g.tripId(), field(l, "tripId"));
        assertTrue(l.contains(priya.id) && l.contains(jonas.id) && l.contains(mia.id), l);
        String id = field(l, "id");

        assertTrue(listed(priya, g.tripId(), id));
        assertTrue(listed(mia, g.tripId(), id));

        assertEquals(404, stranger.get("/api/trips/" + g.tripId() + "/fuel-legs").statusCode());
        assertEquals(404, stranger.post("/api/trips/" + g.tripId() + "/fuel-legs", leg("x", 10, 8, 200, priya.id, priya.id)).statusCode());
        assertEquals(401, signedOut.get("/api/trips/" + g.tripId() + "/fuel-legs").statusCode());
        assertEquals(404, priya.get("/api/trips/" + UUID.randomUUID() + "/fuel-legs").statusCode());
    }

    @Test
    void legsComeBackInTheOrderTheyWereMade() throws Exception {
        Group g = group(2);
        Person priya = g.owner();
        String first = add(priya, g.tripId(), leg("First", 10, 8, 200, priya.id, priya.id));
        Thread.sleep(5);
        String second = add(priya, g.tripId(), leg("Second", 10, 8, 200, priya.id, priya.id));
        Thread.sleep(5);
        String third = add(priya, g.tripId(), leg("Third", 10, 8, 200, priya.id, priya.id));
        String all = list(priya, g.tripId());
        int a = all.indexOf(first), b = all.indexOf(second), c = all.indexOf(third);
        assertTrue(a >= 0 && a < b && b < c, all);
    }

    @Test
    void aLegGetsAnExpenseThatIsPaidByTheDriverAndCannotBeTouchedOnItsOwn() throws Exception {
        Group g = group(3);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2);
        String id = add(jonas, g.tripId(), leg("Lorne to Apollo Bay", 100, 8, 200, mia.id, jonas.id, mia.id));

        String all = expenses(priya, g.tripId());
        assertTrue(all.contains("\"description\":\"Fuel: Lorne to Apollo Bay\""), all);
        assertTrue(all.contains("\"amountCents\":1600"), all);
        assertTrue(all.contains("\"source\":\"fuel\""), all);
        assertTrue(all.contains("\"sourceId\":\"" + id + "\""), all);
        assertTrue(all.contains("\"category\":\"transport\""), all);
        assertEquals(mia.id, field(all, "paidBy"));
        assertEquals(jonas.id, field(all, "createdBy"));
        assertTrue(all.contains("\"split\":null"), all);
        String expenseId = field(all, "id");

        // Not by the person who added it, not by the driver, not by the owner.
        for (Person p : List.of(jonas, mia, priya)) {
            HttpResponse<String> edit = p.patch("/api/expenses/" + expenseId, "{\"amountCents\":1}");
            assertEquals(403, edit.statusCode(), edit.body());
            assertEquals("forbidden", field(edit.body(), "code"));
            assertEquals(403, p.delete("/api/expenses/" + expenseId).statusCode());
        }
        assertTrue(expenses(priya, g.tripId()).contains("\"amountCents\":1600"));
    }

    @Test
    void aBadRequestIsRefusedWithAMessageAndNothingIsAdded() throws Exception {
        Group g = group(2);
        Person priya = g.owner(), jonas = g.people().get(1);
        Person stranger = new Person("Sam", true);
        String url = "/api/trips/" + g.tripId() + "/fuel-legs";

        for (String bad : List.of(
                leg("   ", 100, 8, 200, priya.id, priya.id),
                leg("x".repeat(91), 100, 8, 200, priya.id, priya.id),
                leg("x", 0, 8, 200, priya.id, priya.id),
                leg("x", -1, 8, 200, priya.id, priya.id),
                leg("x", "\"100\"", 8, 200, priya.id, priya.id),
                leg("x", 100_001, 8, 200, priya.id, priya.id),
                leg("x", 100, 0, 200, priya.id, priya.id),
                leg("x", 100, 100.5, 200, priya.id, priya.id),
                leg("x", 100, 8, 0, priya.id, priya.id),
                leg("x", 100, 8, 195.5, priya.id, priya.id),
                leg("x", 100, 8, 100_001, priya.id, priya.id),
                leg("x", 100, 8, "\"200\"", priya.id, priya.id),
                leg("x", 100, 8, 200, UUID.randomUUID().toString(), priya.id),
                leg("x", 100, 8, 200, stranger.id, priya.id),
                leg("x", 100, 8, 200, priya.id),
                leg("x", 100, 8, 200, priya.id, stranger.id),
                leg("x", 100, 8, 200, priya.id, priya.id, stranger.id),
                leg("x", 0.01, 0.5, 5, priya.id, priya.id),
                "{\"label\":\"x\",\"distanceKm\":100,\"efficiencyL100km\":8,\"pricePerLitreCents\":200,\"driverId\":\"" + priya.id + "\"}",
                "{\"label\":\"x\",\"distanceKm\":100,\"efficiencyL100km\":8,\"pricePerLitreCents\":200,\"driverId\":\"" + priya.id + "\",\"riderIds\":\"" + priya.id + "\"}",
                "{}")) {
            HttpResponse<String> response = priya.post(url, bad);
            assertEquals(400, response.statusCode(), bad + " -> " + response.body());
            assertEquals("invalid", field(response.body(), "code"), response.body());
            assertFalse(field(response.body(), "message").isBlank());
        }
        // Not JSON at all, and JSON that is not an object.
        assertEquals(400, priya.post(url, "{nope").statusCode());
        assertEquals(400, priya.post(url, "[]").statusCode());
        assertEquals("[]", list(priya, g.tripId()), "refused requests added no legs");
        assertEquals("[]", expenses(priya, g.tripId()), "or expenses");
        // The edge that is allowed.
        assertEquals(201, jonas.post(url, leg("x", 100_000, 100, 100_000, jonas.id, jonas.id)).statusCode());
    }

    @Test
    void theNextFormStartsFromTheLastLeg() throws Exception {
        Group g = group(2);
        Person priya = g.owner();
        add(priya, g.tripId(), leg("Hop", 50, 6.5, 210, priya.id, priya.id));
        HttpResponse<String> trip = priya.get("/api/trips/" + g.tripId());
        assertEquals(200, trip.statusCode(), trip.body());
        assertTrue(trip.body().contains("\"defaultEfficiency\":6.5"), trip.body());
        assertTrue(trip.body().contains("\"defaultPricePerLitreCents\":210"), trip.body());
        // A refused leg changes neither.
        assertEquals(400, priya.post("/api/trips/" + g.tripId() + "/fuel-legs", leg("Bad", 0, 9, 300, priya.id, priya.id)).statusCode());
        HttpResponse<String> again = priya.get("/api/trips/" + g.tripId());
        assertTrue(again.body().contains("\"defaultEfficiency\":6.5"), again.body());
        assertTrue(again.body().contains("\"defaultPricePerLitreCents\":210"), again.body());
    }

    @Test
    void whoCanChangeAndDelete() throws Exception {
        Group g = group(4);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2), cara = g.people().get(3);
        Person stranger = new Person("Sam", true);
        // Jonas added it; Mia drove.
        String id = add(jonas, g.tripId(), leg("Drive", 100, 8, 200, mia.id, jonas.id, mia.id, cara.id));
        String path = "/api/fuel-legs/" + id;

        HttpResponse<String> refused = cara.patch(path, "{\"label\":\"Hijack\"}");
        assertEquals(403, refused.statusCode(), refused.body());
        assertEquals("forbidden", field(refused.body(), "code"));
        assertEquals(403, cara.delete(path).statusCode());
        assertTrue(listed(cara, g.tripId(), id));
        assertEquals(404, stranger.patch(path, "{\"label\":\"x\"}").statusCode());
        assertEquals(404, stranger.delete(path).statusCode());

        // Whoever added it, the driver and the owner can change it. A partial change leaves the rest.
        HttpResponse<String> renamed = jonas.patch(path, "{\"label\":\"Long drive\"}");
        assertEquals(200, renamed.statusCode(), renamed.body());
        assertEquals("Long drive", field(renamed.body(), "label"));
        assertTrue(renamed.body().contains("\"distanceKm\":100.0"), renamed.body());
        assertEquals(mia.id, field(renamed.body(), "driverId"));
        assertTrue(renamed.body().contains(cara.id), renamed.body());
        assertEquals(200, mia.patch(path, "{\"pricePerLitreCents\":250}").statusCode());
        HttpResponse<String> byOwner = priya.patch(path, "{\"distanceKm\":200}");
        assertEquals(200, byOwner.statusCode(), byOwner.body());
        // The expense followed every change: 200 km at 8 L/100 km and 250 c/L is $40.
        String all = expenses(priya, g.tripId());
        assertTrue(all.contains("\"description\":\"Fuel: Long drive\""), all);
        assertTrue(all.contains("\"amountCents\":4000"), all);
        // Fields that are not patchable are ignored.
        HttpResponse<String> ignored = jonas.patch(path, "{\"createdBy\":\"" + cara.id + "\",\"tripId\":\"" + UUID.randomUUID() + "\"}");
        assertEquals(200, ignored.statusCode(), ignored.body());
        assertEquals(jonas.id, field(ignored.body(), "createdBy"));
        assertEquals(g.tripId(), field(ignored.body(), "tripId"));
        // A bad change is refused and changes nothing, including the expense.
        assertEquals(400, jonas.patch(path, "{\"distanceKm\":0}").statusCode());
        assertEquals(400, jonas.patch(path, "{\"driverId\":\"" + stranger.id + "\"}").statusCode());
        assertEquals(400, jonas.patch(path, "{\"riderIds\":[]}").statusCode());
        assertEquals(400, jonas.patch(path, "{\"pricePerLitreCents\":1.5}").statusCode());
        assertTrue(expenses(priya, g.tripId()).contains("\"amountCents\":4000"));
        assertTrue(list(priya, g.tripId()).contains("\"distanceKm\":200.0"));

        // Another driver becomes the payer, and the old one loses the right to change it.
        assertEquals(200, jonas.patch(path, "{\"driverId\":\"" + cara.id + "\"}").statusCode());
        assertEquals(cara.id, field(expenses(priya, g.tripId()), "paidBy"));
        assertEquals(200, jonas.patch(path, "{\"label\":\"Still mine\"}").statusCode());
        assertEquals(403, mia.patch(path, "{\"label\":\"No longer\"}").statusCode());

        // Delete: the person who added it, the driver and the owner.
        assertEquals(204, cara.delete(path).statusCode());
        assertFalse(listed(priya, g.tripId(), id));
        assertEquals("[]", expenses(priya, g.tripId()), "its expense went with it");
        assertEquals(404, cara.delete(path).statusCode());
        assertEquals(404, priya.patch(path, "{\"label\":\"x\"}").statusCode());
        String byJonas = add(jonas, g.tripId(), leg("A", 10, 8, 200, cara.id, cara.id));
        assertEquals(204, jonas.delete("/api/fuel-legs/" + byJonas).statusCode());
        String viaOwner = add(jonas, g.tripId(), leg("B", 10, 8, 200, cara.id, cara.id));
        assertEquals(204, priya.delete("/api/fuel-legs/" + viaOwner).statusCode());
        assertEquals("[]", expenses(priya, g.tripId()));
    }

    @Test
    void ridersCanBeChangedAsOftenAsYouLike() throws Exception {
        Group g = group(3);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2);
        String id = add(priya, g.tripId(), leg("Drive", 100, 8, 200, priya.id, priya.id, jonas.id));
        String path = "/api/fuel-legs/" + id;
        // Swapping people, keeping one of them, which writes a row that was there a moment before.
        for (int i = 0; i < 3; i++) {
            HttpResponse<String> a = priya.patch(path, "{\"riderIds\":[" + ids(jonas.id, mia.id) + "]}");
            assertEquals(200, a.statusCode(), a.body());
            HttpResponse<String> b = priya.patch(path, "{\"riderIds\":[" + ids(priya.id, jonas.id) + "]}");
            assertEquals(200, b.statusCode(), b.body());
            assertFalse(b.body().contains(mia.id), b.body());
        }
        String now = list(priya, g.tripId());
        assertTrue(now.contains(priya.id) && now.contains(jonas.id) && !now.contains(mia.id), now);
    }

    @Test
    void whatSomeoneDroveOrRodeStaysWhenTheyLeave() throws Exception {
        Group g = group(3);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2);
        String drove = add(jonas, g.tripId(), leg("Jonas drove", 100, 8, 200, jonas.id, priya.id, jonas.id, mia.id));
        String rode = add(priya, g.tripId(), leg("Jonas rode", 100, 8, 200, priya.id, priya.id, jonas.id));

        assertEquals(204, jonas.delete("/api/trips/" + g.tripId() + "/members/" + jonas.id).statusCode());

        // Both legs are still there, still naming him, so the money still adds up.
        String all = list(priya, g.tripId());
        assertTrue(listed(mia, g.tripId(), drove));
        assertTrue(all.contains("\"id\":\"" + rode + "\"") && all.contains("\"driverId\":\"" + jonas.id + "\""), all);
        assertTrue(expenses(priya, g.tripId()).contains("\"paidBy\":\"" + jonas.id + "\""));
        // He no longer reaches any of it.
        assertEquals(404, jonas.get("/api/trips/" + g.tripId() + "/fuel-legs").statusCode());
        assertEquals(404, jonas.delete("/api/fuel-legs/" + drove).statusCode());
        assertEquals(404, jonas.patch("/api/fuel-legs/" + drove, "{\"label\":\"x\"}").statusCode());
        // Nobody can start naming him now that he is off the trip.
        assertEquals(400, priya.post("/api/trips/" + g.tripId() + "/fuel-legs", leg("x", 10, 8, 200, jonas.id, priya.id)).statusCode());
        assertEquals(400, priya.post("/api/trips/" + g.tripId() + "/fuel-legs", leg("x", 10, 8, 200, priya.id, jonas.id)).statusCode());
        assertEquals(400, priya.patch("/api/fuel-legs/" + rode, "{\"driverId\":\"" + jonas.id + "\"}").statusCode());
        // But a leg that already names him can be edited without removing him, by the owner or anyone
        // else with the right.
        HttpResponse<String> edited = priya.patch("/api/fuel-legs/" + drove, "{\"label\":\"Still his\"}");
        assertEquals(200, edited.statusCode(), edited.body());
        assertEquals(jonas.id, field(edited.body(), "driverId"));
        // He added it, drove it and rode it, and the edit took none of that away.
        assertEquals(jonas.id, field(edited.body(), "createdBy"));
        assertEquals(3, edited.body().split(java.util.regex.Pattern.quote(jonas.id), -1).length - 1, "as adder, driver and rider: " + edited.body());
        // The owner can still delete a leg he drove.
        assertEquals(204, priya.delete("/api/fuel-legs/" + drove).statusCode());
    }
}
