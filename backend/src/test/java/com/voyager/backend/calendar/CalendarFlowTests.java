package com.voyager.backend.calendar;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;

// Runs the real server on a random port. The pieces of the .ics file itself are checked in the
// service-level checks; these are about the web side: who can reach the download and the
// subscription link, that the link works without a login (a calendar app cannot send one) but
// can only read, and that it stops working when it should.

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CalendarFlowTests {

    private static final String TRIP_BODY = "{\"name\":\"Great Ocean Road\",\"destination\":\"Victoria\"}";
    private static final String START = "2030-06-15T12:30:00.000Z";
    private static final Pattern LINK = Pattern.compile("^/api/calendar/feeds/[A-Za-z0-9_-]{43}\\.ics$");

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

        // register=false gives someone who is not signed in, like a calendar app.
        Person(String displayName, boolean register) throws Exception {
            if (register) {
                HttpResponse<String> response = send("POST", "/api/auth/register",
                        "{\"displayName\":\"" + displayName + "\",\"email\":\"c-" + UUID.randomUUID()
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
        HttpResponse<String> put(String path, String json) throws Exception { return send("PUT", path, json); }
        HttpResponse<String> delete(String path) throws Exception { return send("DELETE", path, null); }
    }

    private static String field(String json, String name) {
        Matcher matcher = Pattern.compile("\"" + name + "\":\"([^\"]*)\"").matcher(json);
        assertTrue(matcher.find(), "no \"" + name + "\" in " + json);
        return matcher.group(1);
    }

    private static String contentType(HttpResponse<String> response) {
        return response.headers().firstValue("Content-Type").orElse("");
    }

    // An owner and a member on one trip; returns the trip's id.
    private String tripWith(Person owner, Person member) throws Exception {
        HttpResponse<String> created = owner.post("/api/trips", TRIP_BODY);
        assertEquals(201, created.statusCode(), created.body());
        String tripId = field(created.body(), "id");
        String code = field(created.body(), "inviteCode");
        assertEquals(200, member.post("/api/trips/join/" + code, null).statusCode());
        return tripId;
    }

    private void addPlanned(Person by, String tripId, String title) throws Exception {
        String body = "{\"title\":\"" + title + "\",\"description\":\"\",\"category\":\"food\",\"proposedStart\":\""
                + START + "\",\"proposedEnd\":null,\"allDay\":false,\"needsVote\":false,\"attendeeIds\":[\"" + by.id + "\"]}";
        assertEquals(201, by.post("/api/trips/" + tripId + "/ideas", body).statusCode());
    }

    private String linkOf(Person person, String tripId) throws Exception {
        HttpResponse<String> response = person.get("/api/trips/" + tripId + "/calendar/feed");
        assertEquals(200, response.statusCode(), response.body());
        String path = field(response.body(), "path");
        assertTrue(LINK.matcher(path).matches(), path);
        return path;
    }

    @Test
    void theDownloadIsACalendarFileForPeopleOnTheTripOnly() throws Exception {
        Person owner = new Person("Priya", true);
        Person member = new Person("Jonas", true);
        Person stranger = new Person("Sam", true);
        Person signedOut = new Person("", false);
        String tripId = tripWith(owner, member);
        addPlanned(owner, tripId, "Dinner, with friends");

        HttpResponse<String> file = member.get("/api/trips/" + tripId + "/calendar.ics");
        assertEquals(200, file.statusCode(), file.body());
        assertTrue(contentType(file).startsWith("text/calendar"), contentType(file));
        assertEquals("attachment; filename=\"voyager-great-ocean-road.ics\"",
                file.headers().firstValue("Content-Disposition").orElse(""));
        assertTrue(file.body().startsWith("BEGIN:VCALENDAR\r\n"), file.body());
        assertTrue(file.body().contains("SUMMARY:Dinner\\, with friends\r\n"), file.body());
        assertTrue(file.body().contains("DTSTART:20300615T123000Z\r\n"), file.body());
        assertTrue(file.body().contains("X-WR-CALNAME:Great Ocean Road\r\n"), file.body());

        assertEquals(404, stranger.get("/api/trips/" + tripId + "/calendar.ics").statusCode());
        assertEquals(401, signedOut.get("/api/trips/" + tripId + "/calendar.ics").statusCode());
    }

    @Test
    void onlyActivitiesGoingAheadAreOnIt() throws Exception {
        Person owner = new Person("Priya", true);
        Person member = new Person("Jonas", true);
        String tripId = tripWith(owner, member);
        addPlanned(owner, tripId, "On the plan");
        String pending = "{\"title\":\"Still voting\",\"description\":\"\",\"category\":\"activity\",\"proposedStart\":\""
                + START + "\",\"proposedEnd\":null,\"allDay\":false,\"needsVote\":true,\"attendeeIds\":[]}";
        HttpResponse<String> added = owner.post("/api/trips/" + tripId + "/ideas", pending);
        assertEquals(201, added.statusCode(), added.body());
        String ideaId = field(added.body(), "id");

        String before = member.get("/api/trips/" + tripId + "/calendar.ics").body();
        assertTrue(before.contains("SUMMARY:On the plan"));
        assertFalse(before.contains("Still voting"), before);

        // Two people, so one more vote carries it.
        assertEquals(204, member.put("/api/ideas/" + ideaId + "/vote", "{\"value\":1}").statusCode());
        String after = member.get("/api/trips/" + tripId + "/calendar.ics").body();
        assertTrue(after.contains("SUMMARY:Still voting"), after);
    }

    @Test
    void theSubscriptionLinkWorksWithoutALoginButCanOnlyRead() throws Exception {
        Person owner = new Person("Priya", true);
        Person member = new Person("Jonas", true);
        Person calendarApp = new Person("", false);
        String tripId = tripWith(owner, member);
        addPlanned(owner, tripId, "Dinner");

        String path = linkOf(owner, tripId);
        assertEquals(path, linkOf(owner, tripId), "the same link every time");
        assertNotEquals(path, linkOf(member, tripId), "everyone has their own");

        HttpResponse<String> feed = calendarApp.get(path);
        assertEquals(200, feed.statusCode(), feed.body());
        assertTrue(contentType(feed).startsWith("text/calendar"), contentType(feed));
        assertTrue(feed.body().contains("SUMMARY:Dinner"), feed.body());
        assertEquals(owner.get("/api/trips/" + tripId + "/calendar.ics").body(), feed.body());

        // Read-only: nothing but GET is open without a login.
        assertEquals(401, calendarApp.post(path, "{}").statusCode());
        assertEquals(401, calendarApp.put(path, "{}").statusCode());
        assertEquals(401, calendarApp.delete(path).statusCode());
        // And the way to find or replace a link still needs one.
        assertEquals(401, calendarApp.get("/api/trips/" + tripId + "/calendar/feed").statusCode());
        assertEquals(401, calendarApp.post("/api/trips/" + tripId + "/calendar/feed", null).statusCode());
    }

    @Test
    void aWrongOrMadeUpLinkIsJustNotFound() throws Exception {
        Person calendarApp = new Person("", false);
        HttpResponse<String> unknown = calendarApp.get("/api/calendar/feeds/" + "a".repeat(43) + ".ics");
        assertEquals(404, unknown.statusCode(), unknown.body());
        assertEquals("not_found", field(unknown.body(), "code"));
        assertEquals(404, calendarApp.get("/api/calendar/feeds/short.ics").statusCode());
        assertEquals(404, calendarApp.get("/api/calendar/feeds/" + "!".repeat(43) + ".ics").statusCode());
    }

    @Test
    void makingANewLinkStopsTheOldOne() throws Exception {
        Person owner = new Person("Priya", true);
        Person member = new Person("Jonas", true);
        Person stranger = new Person("Sam", true);
        Person calendarApp = new Person("", false);
        String tripId = tripWith(owner, member);

        String old = linkOf(owner, tripId);
        assertEquals(200, calendarApp.get(old).statusCode());

        HttpResponse<String> replaced = owner.post("/api/trips/" + tripId + "/calendar/feed", null);
        assertEquals(200, replaced.statusCode(), replaced.body());
        String fresh = field(replaced.body(), "path");
        assertTrue(LINK.matcher(fresh).matches(), fresh);
        assertNotEquals(old, fresh);
        assertEquals(404, calendarApp.get(old).statusCode());
        assertEquals(200, calendarApp.get(fresh).statusCode());
        assertEquals(fresh, linkOf(owner, tripId));

        // Someone else's link is untouched, and a stranger can do neither.
        String theirs = linkOf(member, tripId);
        owner.post("/api/trips/" + tripId + "/calendar/feed", null);
        assertEquals(200, calendarApp.get(theirs).statusCode());
        assertEquals(404, stranger.get("/api/trips/" + tripId + "/calendar/feed").statusCode());
        assertEquals(404, stranger.post("/api/trips/" + tripId + "/calendar/feed", null).statusCode());
    }

    @Test
    void leavingOrBeingRemovedStopsTheLink() throws Exception {
        Person owner = new Person("Priya", true);
        Person leaver = new Person("Jonas", true);
        Person removed = new Person("Mia", true);
        Person calendarApp = new Person("", false);
        String tripId = tripWith(owner, leaver);
        String code = field(owner.get("/api/trips/" + tripId).body(), "inviteCode");
        assertEquals(200, removed.post("/api/trips/join/" + code, null).statusCode());

        String leaversLink = linkOf(leaver, tripId);
        String removedLink = linkOf(removed, tripId);
        assertEquals(200, calendarApp.get(leaversLink).statusCode());
        assertEquals(200, calendarApp.get(removedLink).statusCode());

        assertEquals(204, leaver.delete("/api/trips/" + tripId + "/members/" + leaver.id).statusCode());
        assertEquals(404, calendarApp.get(leaversLink).statusCode());
        assertEquals(204, owner.delete("/api/trips/" + tripId + "/members/" + removed.id).statusCode());
        assertEquals(404, calendarApp.get(removedLink).statusCode());

        // Coming back does not bring the old link back to life.
        assertEquals(200, leaver.post("/api/trips/join/" + code, null).statusCode());
        assertEquals(404, calendarApp.get(leaversLink).statusCode());
        assertNotEquals(leaversLink, linkOf(leaver, tripId));
        // The owner's link was never affected.
        assertEquals(200, calendarApp.get(linkOf(owner, tripId)).statusCode());
    }

    @Test
    void theFileNameIsSafeWhateverTheTripIsCalled() {
        assertEquals("voyager-great-ocean-road", CalendarController.fileName("Great Ocean Road"));
        assertEquals("voyager-trip", CalendarController.fileName("日本"));
        assertEquals("voyager-trip", CalendarController.fileName("  !!  "));
        assertEquals("voyager-a-b-c", CalendarController.fileName("a\"b\r\nc"));
    }
}
