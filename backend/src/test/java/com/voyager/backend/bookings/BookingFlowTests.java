package com.voyager.backend.bookings;

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
// see, add, change and delete bookings, what a bad request is answered with, what happens to a
// person's bookings when they leave, and that bookings reach the calendar file.

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class BookingFlowTests {

    private static final String TRIP_BODY = "{\"name\":\"Great Ocean Road\",\"destination\":\"Victoria\"}";
    private static final String START = "2030-06-15T12:30:00.000Z";
    private static final String END = "2030-06-15T15:00:00.000Z";

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
                        "{\"displayName\":\"" + displayName + "\",\"email\":\"b-" + UUID.randomUUID()
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

    // Each flat { ... } in a list body. Bookings hold no nested objects.
    private static List<String> objects(String json) {
        Matcher matcher = Pattern.compile("\\{[^{}]*\\}").matcher(json);
        List<String> found = new ArrayList<>();
        while (matcher.find()) {
            found.add(matcher.group());
        }
        return found;
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

    private static String body(String type, String title, String start, String belongsTo) {
        return "{\"type\":\"" + type + "\",\"title\":\"" + title + "\",\"provider\":\"Jetstar\",\"reference\":\"K4RT2W\","
                + "\"startsAt\":" + (start == null ? "null" : "\"" + start + "\"") + ",\"endsAt\":null,"
                + "\"origin\":\"BNE\",\"destination\":\"MEL\",\"costCents\":21500,"
                + "\"belongsTo\":" + (belongsTo == null ? "null" : "\"" + belongsTo + "\"") + ",\"notes\":\"window\"}";
    }

    private String add(Person by, String tripId, String json) throws Exception {
        HttpResponse<String> response = by.post("/api/trips/" + tripId + "/bookings", json);
        assertEquals(201, response.statusCode(), response.body());
        return field(response.body(), "id");
    }

    private List<String> list(Person viewer, String tripId) throws Exception {
        HttpResponse<String> response = viewer.get("/api/trips/" + tripId + "/bookings");
        assertEquals(200, response.statusCode(), response.body());
        return objects(response.body());
    }

    private boolean listed(Person viewer, String tripId, String bookingId) throws Exception {
        return list(viewer, tripId).stream().anyMatch(o -> o.contains("\"id\":\"" + bookingId + "\""));
    }

    @Test
    void everyoneOnTheTripSeesEveryBookingAndNobodyElseSeesAny() throws Exception {
        Group g = group(3);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2);
        Person stranger = new Person("Sam", true);
        Person signedOut = new Person("", false);

        HttpResponse<String> created = jonas.post("/api/trips/" + g.tripId() + "/bookings",
                body("flight", "JQ 610", START, jonas.id));
        assertEquals(201, created.statusCode(), created.body());
        String b = created.body();
        assertEquals("flight", field(b, "type"));
        assertEquals("JQ 610", field(b, "title"));
        assertEquals("K4RT2W", field(b, "reference"));
        assertEquals(jonas.id, field(b, "belongsTo"));
        assertEquals(jonas.id, field(b, "createdBy"));
        assertEquals(g.tripId(), field(b, "tripId"));
        assertTrue(b.contains("\"costCents\":21500"), b);
        assertTrue(b.contains("\"endsAt\":null"), b);
        String id = field(b, "id");
        String group = add(priya, g.tripId(), body("stay", "House", null, null));

        // Mia sees both, including the one that is Jonas's.
        assertTrue(listed(mia, g.tripId(), id));
        assertTrue(listed(mia, g.tripId(), group));
        // The one with a time comes before the one with none.
        List<String> all = list(priya, g.tripId());
        assertEquals(2, all.size(), all.toString());
        assertTrue(all.get(0).contains("\"id\":\"" + id + "\""), all.toString());

        assertEquals(404, stranger.get("/api/trips/" + g.tripId() + "/bookings").statusCode());
        assertEquals(404, stranger.post("/api/trips/" + g.tripId() + "/bookings", body("other", "x", null, null)).statusCode());
        assertEquals(401, signedOut.get("/api/trips/" + g.tripId() + "/bookings").statusCode());
        assertEquals(404, priya.get("/api/trips/" + UUID.randomUUID() + "/bookings").statusCode());
    }

    @Test
    void aBadRequestIsRefusedWithAMessage() throws Exception {
        Group g = group(2);
        Person priya = g.owner();
        String url = "/api/trips/" + g.tripId() + "/bookings";

        for (String bad : List.of(
                body("boat", "x", null, null),
                body("other", "   ", null, null),
                body("other", "x".repeat(101), null, null),
                body("other", "x", "2030-06-15T15:00:00Z", null).replace("\"endsAt\":null", "\"endsAt\":\"2030-06-15T12:00:00Z\""),
                body("other", "x", null, UUID.randomUUID().toString()),
                body("other", "x", "tomorrow", null),
                body("other", "x", null, null).replace("21500", "-5"))) {
            HttpResponse<String> response = priya.post(url, bad);
            assertEquals(400, response.statusCode(), bad + " -> " + response.body());
            assertEquals("invalid", field(response.body(), "code"), response.body());
            assertFalse(field(response.body(), "message").isBlank());
        }
        assertEquals(0, list(priya, g.tripId()).size(), "refused requests added nothing");
    }

    @Test
    void whoCanChangeAndDelete() throws Exception {
        Group g = group(3);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2);
        Person stranger = new Person("Sam", true);
        String id = add(jonas, g.tripId(), body("stay", "Motel", START, null));
        String path = "/api/bookings/" + id;

        // Another member can see it but not change or delete it.
        HttpResponse<String> refused = mia.patch(path, "{\"title\":\"Hijack\"}");
        assertEquals(403, refused.statusCode(), refused.body());
        assertEquals("forbidden", field(refused.body(), "code"));
        assertEquals(403, mia.delete(path).statusCode());
        assertTrue(listed(mia, g.tripId(), id));
        assertEquals(404, stranger.patch(path, "{\"title\":\"x\"}").statusCode());
        assertEquals(404, stranger.delete(path).statusCode());

        // The person who added it and the owner can change it, and a partial change leaves the rest.
        HttpResponse<String> changed = jonas.patch(path, "{\"title\":\"Motel 2\"}");
        assertEquals(200, changed.statusCode(), changed.body());
        assertEquals("Motel 2", field(changed.body(), "title"));
        assertEquals("K4RT2W", field(changed.body(), "reference"));
        assertEquals(200, priya.patch(path, "{\"provider\":\"Other Inn\"}").statusCode());

        // null clears the cost, and a field that is not patchable is ignored.
        HttpResponse<String> cleared = jonas.patch(path, "{\"costCents\":null,\"createdBy\":\"" + mia.id + "\"}");
        assertEquals(200, cleared.statusCode(), cleared.body());
        assertTrue(cleared.body().contains("\"costCents\":null"), cleared.body());
        assertEquals(jonas.id, field(cleared.body(), "createdBy"));
        // A change that leaves it ending before it starts is refused, and changes nothing.
        assertEquals(400, jonas.patch(path, "{\"endsAt\":\"2030-01-01T00:00:00Z\"}").statusCode());
        assertTrue(list(jonas, g.tripId()).get(0).contains("\"endsAt\":null"));

        // The person it is for can delete a booking someone else added for them.
        String forMia = add(priya, g.tripId(), body("car", "Car", null, mia.id));
        assertEquals(200, mia.patch("/api/bookings/" + forMia, "{\"title\":\"Mia's car\"}").statusCode());
        assertEquals(204, mia.delete("/api/bookings/" + forMia).statusCode());
        assertFalse(listed(priya, g.tripId(), forMia));

        assertEquals(204, jonas.delete(path).statusCode());
        assertFalse(listed(priya, g.tripId(), id));
        assertEquals(404, jonas.delete(path).statusCode());
        assertEquals(404, priya.patch(path, "{\"title\":\"x\"}").statusCode());
        String viaOwner = add(jonas, g.tripId(), body("other", "Owner deletes", null, null));
        assertEquals(204, priya.delete("/api/bookings/" + viaOwner).statusCode());
    }

    @Test
    void whatBelongedToSomeoneWhoLeavesGoesWithThem() throws Exception {
        Group g = group(3);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2);
        String personal = add(jonas, g.tripId(), body("flight", "Jonas flight", START, jonas.id));
        String forHim = add(priya, g.tripId(), body("car", "Car for Jonas", null, jonas.id));
        String group = add(jonas, g.tripId(), body("stay", "Group stay", null, null));
        String forMia = add(jonas, g.tripId(), body("other", "For Mia", null, mia.id));

        assertEquals(204, jonas.delete("/api/trips/" + g.tripId() + "/members/" + jonas.id).statusCode());

        assertFalse(listed(priya, g.tripId(), personal));
        assertFalse(listed(priya, g.tripId(), forHim));
        assertTrue(listed(priya, g.tripId(), group));
        assertTrue(listed(priya, g.tripId(), forMia));
        // The leaver no longer reaches any of it.
        assertEquals(404, jonas.get("/api/trips/" + g.tripId() + "/bookings").statusCode());
        assertEquals(404, jonas.patch("/api/bookings/" + group, "{\"title\":\"x\"}").statusCode());
        // Coming back does not bring them back.
        assertEquals(200, jonas.post("/api/trips/join/" + g.code(), null).statusCode());
        assertFalse(listed(jonas, g.tripId(), personal));
    }

    @Test
    void bookingsWithATimeAreInTheCalendarFileButTheirReferenceIsNot() throws Exception {
        Group g = group(2);
        Person priya = g.owner(), jonas = g.people().get(1);
        add(jonas, g.tripId(), body("flight", "JQ 610", START, jonas.id));
        add(priya, g.tripId(), body("stay", "No time yet", null, null));

        String file = priya.get("/api/trips/" + g.tripId() + "/calendar.ics").body();
        assertTrue(file.contains("SUMMARY:JQ 610\r\n"), file);
        assertTrue(file.contains("DTSTART:20300615T123000Z\r\n"), file);
        assertTrue(file.contains("CATEGORIES:flight\r\n"), file);
        assertTrue(file.contains("DESCRIPTION:Person1's booking · Jetstar · BNE to MEL\r\n"), file);
        assertFalse(file.contains("No time yet"), file);
        assertFalse(file.contains("K4RT2W"), "the reference stays out of a file that can be passed around");
        assertFalse(file.contains("window"), "and so do the notes");
    }
}
