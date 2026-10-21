package com.voyager.backend.activities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.Arrays;
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

// Runs the real server on a random port. Every person is a separate signed-in client with their own
// cookie jar. These check who may do what with activities and votes, that the status follows the
// votes, what happens to a person's votes when they leave, and the "two requests at the same moment"
// cases the locking exists for.

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class IdeaFlowTests {

    private static final String TRIP_BODY = "{\"name\":\"Great Ocean Road\",\"destination\":\"Victoria\"}";
    private static final String START = "2026-11-08T05:30:00.000Z";
    private static final long WAIT_SECONDS = 5;

    @Autowired
    private Environment environment;

    private String base;

    @BeforeEach
    void setUp() {
        base = "http://localhost:" + environment.getProperty("local.server.port");
    }

    /* A signed-in person */

    private final class Person {
        final CookieManager cookies = new CookieManager();
        final HttpClient client = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .cookieHandler(cookies)
                .build();
        final String id;

        // register=false gives someone who is not signed in.
        Person(String displayName, boolean register) throws Exception {
            if (register) {
                HttpResponse<String> response = send("POST", "/api/auth/register",
                        "{\"displayName\":\"" + displayName + "\",\"email\":\"i-" + UUID.randomUUID()
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
        HttpResponse<String> patch(String path, String json) throws Exception { return send("PATCH", path, json); }
        HttpResponse<String> delete(String path) throws Exception { return send("DELETE", path, null); }
    }

    private Person person(String displayName) throws Exception {
        return new Person(displayName, true);
    }

    /* Small helpers */

    // The first value of a string field in a JSON body. Enough for these flat responses.
    private static String field(String json, String name) {
        Matcher matcher = Pattern.compile("\"" + name + "\":\"([^\"]*)\"").matcher(json);
        assertTrue(matcher.find(), "no \"" + name + "\" in " + json);
        return matcher.group(1);
    }

    // Each flat { ... } in a list body. Activities and votes hold no nested objects.
    private static List<String> objects(String json) {
        Matcher matcher = Pattern.compile("\\{[^{}]*\\}").matcher(json);
        List<String> found = new ArrayList<>();
        while (matcher.find()) {
            found.add(matcher.group());
        }
        return found;
    }

    private static String code(HttpResponse<String> response) {
        return field(response.body(), "code");
    }

    // The ids inside "attendeeIds":[...] of one activity, in order.
    private static List<String> going(String idea) {
        Matcher matcher = Pattern.compile("\"attendeeIds\":\\[([^\\]]*)\\]").matcher(idea);
        assertTrue(matcher.find(), idea);
        String inside = matcher.group(1).replace("\"", "").trim();
        return inside.isEmpty() ? List.of() : Arrays.asList(inside.split(","));
    }

    private String createTrip(Person owner) throws Exception {
        HttpResponse<String> response = owner.post("/api/trips", TRIP_BODY);
        assertEquals(201, response.statusCode(), response.body());
        return field(response.body(), "id");
    }

    private void join(Person member, String tripId, Person owner) throws Exception {
        String code = field(owner.get("/api/trips/" + tripId).body(), "inviteCode");
        assertEquals(200, member.post("/api/trips/join/" + code, null).statusCode());
    }

    // A trip with this many people on it: the first is the owner.
    private record Group(String tripId, List<Person> people) {
        Person owner() { return people.get(0); }
    }

    private Group group(int size) throws Exception {
        List<Person> people = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            people.add(person("Person" + i));
        }
        String tripId = createTrip(people.get(0));
        for (int i = 1; i < size; i++) {
            join(people.get(i), tripId, people.get(0));
        }
        return new Group(tripId, people);
    }

    private static String vote(String title) {
        return "{\"title\":\"" + title + "\",\"description\":\"\",\"category\":\"activity\",\"proposedStart\":null,"
                + "\"proposedEnd\":null,\"allDay\":false,\"needsVote\":true,\"attendeeIds\":[]}";
    }

    private static String plan(String title, String start, String... going) {
        String ids = Arrays.stream(going).map(id -> "\"" + id + "\"").reduce((a, b) -> a + "," + b).orElse("");
        return "{\"title\":\"" + title + "\",\"description\":\"\",\"category\":\"food\",\"proposedStart\":"
                + (start == null ? "null" : "\"" + start + "\"") + ",\"proposedEnd\":null,\"allDay\":false,"
                + "\"needsVote\":false,\"attendeeIds\":[" + ids + "]}";
    }

    // Adds an activity and returns its id.
    private String add(Person by, String tripId, String body) throws Exception {
        HttpResponse<String> response = by.post("/api/trips/" + tripId + "/ideas", body);
        assertEquals(201, response.statusCode(), response.body());
        return field(response.body(), "id");
    }

    private HttpResponse<String> cast(Person by, String ideaId, int value) throws Exception {
        return by.put("/api/ideas/" + ideaId + "/vote", "{\"value\":" + value + "}");
    }

    // One activity as the list shows it to this person.
    private String idea(Person viewer, String tripId, String ideaId) throws Exception {
        HttpResponse<String> response = viewer.get("/api/trips/" + tripId + "/ideas");
        assertEquals(200, response.statusCode(), response.body());
        return objects(response.body()).stream()
                .filter(o -> o.contains("\"id\":\"" + ideaId + "\""))
                .findFirst()
                .orElseThrow(() -> new AssertionError("not in the list: " + response.body()));
    }

    private String status(Person viewer, String tripId, String ideaId) throws Exception {
        return field(idea(viewer, tripId, ideaId), "status");
    }

    private List<String> votesOn(Person viewer, String tripId, String ideaId) throws Exception {
        HttpResponse<String> response = viewer.get("/api/trips/" + tripId + "/votes");
        assertEquals(200, response.statusCode(), response.body());
        return objects(response.body()).stream()
                .filter(o -> o.contains("\"ideaId\":\"" + ideaId + "\""))
                .toList();
    }

    // The first time each kind of request runs it is slower (queries are prepared, classes load). A
    // request waiting for the trip's lock only waits a couple of seconds before the database gives
    // up on it, so the same-moment tests do one of each kind first, to measure the locking and
    // not the warm-up.
    private void warmUp(Group g) throws Exception {
        Person owner = g.owner();
        String voted = add(owner, g.tripId(), vote("Warm up"));
        assertEquals(204, cast(owner, voted, 1).statusCode());
        assertEquals(204, owner.delete("/api/ideas/" + voted + "/vote").statusCode());
        String planned = add(owner, g.tripId(), plan("Warm up too", START, owner.id));
        assertEquals(200, owner.put("/api/ideas/" + planned + "/attendance", "{\"attending\":false}").statusCode());
        assertEquals(200, owner.get("/api/trips/" + g.tripId() + "/ideas").statusCode());
        assertEquals(200, owner.get("/api/trips/" + g.tripId() + "/votes").statusCode());
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
            assertTrue(ready.await(WAIT_SECONDS, TimeUnit.SECONDS));
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

    /* Putting one to a vote */

    @Test
    void anActivityPutToTheGroupStartsWithTheProposersOwnVote() throws Exception {
        Group g = group(3);
        Person priya = g.owner();
        HttpResponse<String> response = priya.post("/api/trips/" + g.tripId() + "/ideas",
                "{\"title\":\"  Kayak  \",\"description\":\" seals \",\"category\":\"activity\","
                        + "\"proposedStart\":\"" + START + "\",\"proposedEnd\":null,\"allDay\":false,\"needsVote\":true,\"attendeeIds\":[]}");

        assertEquals(201, response.statusCode(), response.body());
        String body = response.body();
        assertEquals("Kayak", field(body, "title"));
        assertEquals("seals", field(body, "description"));
        assertEquals("activity", field(body, "category"));
        assertEquals("voting", field(body, "status"));
        assertEquals(priya.id, field(body, "proposedBy"));
        assertEquals(g.tripId(), field(body, "tripId"));
        assertTrue(body.contains("\"proposedStart\":\"2026-11-08T05:30:00"), body);
        assertTrue(body.contains("\"proposedEnd\":null"), body);
        assertTrue(body.contains("\"allDay\":false"), body);
        assertEquals(List.of(priya.id), going(body));

        List<String> votes = votesOn(g.people().get(1), g.tripId(), field(body, "id"));
        assertEquals(1, votes.size());
        assertEquals(priya.id, field(votes.get(0), "userId"));
        assertTrue(votes.get(0).contains("\"value\":1"), votes.get(0));
    }

    @Test
    void theStatusFollowsTheVotesAndEveryoneWhoAgreedIsGoingOnceItIsCarried() throws Exception {
        Group g = group(3);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2);
        String ideaId = add(priya, g.tripId(), vote("Kayak"));
        assertEquals("voting", status(mia, g.tripId(), ideaId));

        assertEquals(204, cast(jonas, ideaId, 1).statusCode());
        String carried = idea(mia, g.tripId(), ideaId);
        assertEquals("agreed", field(carried, "status"));
        assertEquals(List.of(priya.id, jonas.id), going(carried));

        assertEquals(204, cast(mia, ideaId, -1).statusCode());
        assertEquals("agreed", status(priya, g.tripId(), ideaId));

        assertEquals(204, cast(jonas, ideaId, -1).statusCode());
        assertEquals("voting", status(priya, g.tripId(), ideaId));
        assertEquals(3, votesOn(priya, g.tripId(), ideaId).size(), "changing a vote replaces it");

        assertEquals(204, jonas.delete("/api/ideas/" + ideaId + "/vote").statusCode());
        assertEquals(2, votesOn(priya, g.tripId(), ideaId).size());
        assertEquals(204, jonas.delete("/api/ideas/" + ideaId + "/vote").statusCode(), "withdrawing twice is fine");

        assertEquals(204, cast(jonas, ideaId, 1).statusCode());
        assertEquals("agreed", status(priya, g.tripId(), ideaId));
        assertEquals(List.of(priya.id, jonas.id), going(idea(priya, g.tripId(), ideaId)), "nobody is added twice");

        assertEquals(204, jonas.delete("/api/ideas/" + ideaId + "/vote").statusCode());
        assertEquals("voting", status(priya, g.tripId(), ideaId), "taking back the vote that carried it");
    }

    @Test
    void aVoteMustBeForOrAgainst() throws Exception {
        Group g = group(2);
        String ideaId = add(g.owner(), g.tripId(), vote("Kayak"));
        Person jonas = g.people().get(1);

        for (int bad : new int[] {0, 2, -3}) {
            HttpResponse<String> response = cast(jonas, ideaId, bad);
            assertEquals(400, response.statusCode(), response.body());
            assertEquals("invalid", code(response));
        }
        assertEquals(400, jonas.put("/api/ideas/" + ideaId + "/vote", "{}").statusCode());
        assertEquals(400, jonas.put("/api/ideas/" + ideaId + "/vote", "{\"value\":\"up\"}").statusCode());
        assertEquals(400, jonas.put("/api/ideas/" + ideaId + "/vote", "not json").statusCode());
        assertEquals(1, votesOn(jonas, g.tripId(), ideaId).size());
    }

    /* Straight onto the plan */

    @Test
    void anActivityAddedStraightToThePlanHasNoVoteAndNamesWhoIsGoing() throws Exception {
        Group g = group(3);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2);

        String ideaId = add(jonas, g.tripId(), plan("Lunch", START, jonas.id, priya.id, jonas.id));
        String listed = idea(mia, g.tripId(), ideaId);
        assertEquals("planned", field(listed, "status"));
        assertEquals(List.of(jonas.id, priya.id), going(listed), "each person once, in the order named");
        assertEquals(0, votesOn(mia, g.tripId(), ideaId).size());

        HttpResponse<String> refused = cast(mia, ideaId, 1);
        assertEquals(400, refused.statusCode());
        assertEquals("This one was added without a vote.", field(refused.body(), "message"));
        assertEquals(400, mia.delete("/api/ideas/" + ideaId + "/vote").statusCode());
    }

    @Test
    void addingStraightToThePlanNeedsATimeAndSomeoneGoingAndOnlyPeopleOnTheTrip() throws Exception {
        Group g = group(2);
        Person priya = g.owner(), jonas = g.people().get(1);
        Person stranger = person("Stranger");

        HttpResponse<String> noTime = priya.post("/api/trips/" + g.tripId() + "/ideas", plan("Lunch", null, priya.id));
        assertEquals(400, noTime.statusCode());
        assertEquals("Pick a date and time.", field(noTime.body(), "message"));

        HttpResponse<String> noOne = priya.post("/api/trips/" + g.tripId() + "/ideas", plan("Lunch", START));
        assertEquals(400, noOne.statusCode());
        assertEquals("Pick at least one person who is going.", field(noOne.body(), "message"));

        HttpResponse<String> outsider = priya.post("/api/trips/" + g.tripId() + "/ideas", plan("Lunch", START, priya.id, stranger.id));
        assertEquals(400, outsider.statusCode());
        assertEquals("Everyone going has to be on the trip.", field(outsider.body(), "message"));

        assertEquals(400, priya.post("/api/trips/" + g.tripId() + "/ideas", plan("Lunch", START, "not-an-id")).statusCode());
        assertEquals("[]", jonas.get("/api/trips/" + g.tripId() + "/ideas").body(), "refused ones leave nothing behind");
    }

    @Test
    void anyoneCanSayTheyAreInOrOutOnceItIsGoingAheadAndNotBefore() throws Exception {
        Group g = group(3);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2);
        String planned = add(priya, g.tripId(), plan("Lunch", START, priya.id));
        String open = add(priya, g.tripId(), vote("Surf"));

        HttpResponse<String> in = mia.put("/api/ideas/" + planned + "/attendance", "{\"attending\":true}");
        assertEquals(200, in.statusCode(), in.body());
        assertEquals(List.of(priya.id, mia.id), going(in.body()));
        assertEquals(List.of(priya.id, mia.id), going(mia.put("/api/ideas/" + planned + "/attendance", "{\"attending\":true}").body()));
        assertEquals(List.of(priya.id), going(mia.put("/api/ideas/" + planned + "/attendance", "{\"attending\":false}").body()));
        assertEquals(List.of(priya.id), going(mia.put("/api/ideas/" + planned + "/attendance", "{\"attending\":false}").body()));
        assertEquals(List.of(priya.id, jonas.id), going(jonas.put("/api/ideas/" + planned + "/attendance", "{\"attending\":true}").body()));

        HttpResponse<String> early = jonas.put("/api/ideas/" + open + "/attendance", "{\"attending\":true}");
        assertEquals(400, early.statusCode());
        assertEquals("You can join once it is going ahead.", field(early.body(), "message"));
        assertEquals(400, jonas.put("/api/ideas/" + planned + "/attendance", "{}").statusCode());

        // Carried by votes, it is open to everyone as well.
        assertEquals(204, cast(jonas, open, 1).statusCode());
        assertEquals("agreed", status(priya, g.tripId(), open));
        assertEquals(List.of(priya.id, jonas.id, mia.id),
                going(mia.put("/api/ideas/" + open + "/attendance", "{\"attending\":true}").body()));
    }

    /* Checking what is sent */

    @Test
    void textAndTimesAreCheckedWithAMessageNotAClash() throws Exception {
        Group g = group(2);
        Person priya = g.owner();
        String path = "/api/trips/" + g.tripId() + "/ideas";

        HttpResponse<String> blank = priya.post(path, vote("   "));
        assertEquals(400, blank.statusCode());
        assertEquals("Give the activity a title.", field(blank.body(), "message"));

        assertEquals(201, priya.post(path, vote("x".repeat(100))).statusCode());
        HttpResponse<String> longTitle = priya.post(path, vote("x".repeat(101)));
        assertEquals(400, longTitle.statusCode(), longTitle.body());
        assertEquals("invalid", code(longTitle));
        assertTrue(field(longTitle.body(), "message").contains("too long"));

        String withNote = vote("Long note").replace("\"description\":\"\"", "\"description\":\"" + "y".repeat(2000) + "\"");
        assertEquals(201, priya.post(path, withNote).statusCode());
        HttpResponse<String> longNote = priya.post(path, withNote.replace("y".repeat(2000), "y".repeat(2001)));
        assertEquals(400, longNote.statusCode(), longNote.body());
        assertTrue(field(longNote.body(), "message").contains("too long"));

        assertEquals("Pick a category.", field(priya.post(path, vote("a").replace("\"activity\"", "\"party\"")).body(), "message"));
        assertEquals(400, priya.post(path, vote("a").replace("\"proposedStart\":null", "\"proposedStart\":\"tomorrow\"")).statusCode());
        assertEquals("It cannot end before it starts.", field(priya.post(path, vote("a")
                .replace("\"proposedStart\":null", "\"proposedStart\":\"" + START + "\"")
                .replace("\"proposedEnd\":null", "\"proposedEnd\":\"2026-11-08T04:00:00Z\"")).body(), "message"));
        assertEquals(400, priya.post(path, vote("a").replace("\"needsVote\":true,", "")).statusCode(), "needsVote is required");
        assertEquals(400, priya.post(path, "{\"title\":").statusCode());
        assertEquals(400, priya.post(path, "[]").statusCode());
    }

    @Test
    void anIdThatIsNotAnIdIsNotFoundAndEveryRouteNeedsASignedInPerson() throws Exception {
        Group g = group(2);
        Person priya = g.owner();
        Person nobody = new Person("Nobody", false);
        String ideaId = add(priya, g.tripId(), vote("Kayak"));

        assertEquals(404, priya.get("/api/trips/nope/ideas").statusCode());
        assertEquals(404, priya.delete("/api/ideas/nope").statusCode());
        assertEquals(404, cast(priya, UUID.randomUUID().toString(), 1).statusCode());

        assertEquals(401, nobody.get("/api/trips/" + g.tripId() + "/ideas").statusCode());
        assertEquals(401, nobody.get("/api/trips/" + g.tripId() + "/votes").statusCode());
        assertEquals(401, nobody.post("/api/trips/" + g.tripId() + "/ideas", vote("x")).statusCode());
        assertEquals(401, nobody.patch("/api/ideas/" + ideaId, "{\"title\":\"x\"}").statusCode());
        assertEquals(401, nobody.put("/api/ideas/" + ideaId + "/status", "{\"status\":\"rejected\"}").statusCode());
        assertEquals(401, nobody.put("/api/ideas/" + ideaId + "/attendance", "{\"attending\":true}").statusCode());
        assertEquals(401, nobody.delete("/api/ideas/" + ideaId).statusCode());
        assertEquals(401, cast(nobody, ideaId, 1).statusCode());
        assertEquals(401, nobody.delete("/api/ideas/" + ideaId + "/vote").statusCode());
    }

    /* Who can see and touch what */

    @Test
    void somebodyNotOnTheTripCannotSeeOrTouchItsActivities() throws Exception {
        Group g = group(2);
        Person priya = g.owner();
        Person stranger = person("Stranger");
        String voted = add(priya, g.tripId(), vote("Kayak"));
        String planned = add(priya, g.tripId(), plan("Lunch", START, priya.id));

        assertEquals(404, stranger.get("/api/trips/" + g.tripId() + "/ideas").statusCode());
        assertEquals(404, stranger.get("/api/trips/" + g.tripId() + "/votes").statusCode());
        assertEquals(404, stranger.post("/api/trips/" + g.tripId() + "/ideas", vote("Sneaky")).statusCode());
        assertEquals(404, cast(stranger, voted, 1).statusCode());
        assertEquals(404, stranger.delete("/api/ideas/" + voted + "/vote").statusCode());
        assertEquals(404, stranger.put("/api/ideas/" + planned + "/attendance", "{\"attending\":true}").statusCode());
        assertEquals(404, stranger.patch("/api/ideas/" + voted, "{\"title\":\"Mine\"}").statusCode());
        assertEquals(404, stranger.put("/api/ideas/" + voted + "/status", "{\"status\":\"rejected\"}").statusCode());
        assertEquals(404, stranger.delete("/api/ideas/" + voted).statusCode());

        // Nothing changed, and it looks exactly like an activity that is not there.
        assertEquals("voting", status(priya, g.tripId(), voted));
        assertEquals(1, votesOn(priya, g.tripId(), voted).size());
        HttpResponse<String> missing = stranger.delete("/api/ideas/" + UUID.randomUUID());
        HttpResponse<String> hidden = stranger.delete("/api/ideas/" + voted);
        assertEquals(missing.body(), hidden.body());
    }

    @Test
    void activitiesOfOneTripNeverShowOnAnother() throws Exception {
        Group a = group(2);
        Group b = group(2);
        String inA = add(a.owner(), a.tripId(), vote("In A"));
        String inB = add(b.owner(), b.tripId(), vote("In B"));

        assertTrue(a.owner().get("/api/trips/" + a.tripId() + "/ideas").body().contains(inA));
        assertFalse(a.owner().get("/api/trips/" + a.tripId() + "/ideas").body().contains(inB));
        assertFalse(a.owner().get("/api/trips/" + a.tripId() + "/votes").body().contains(inB));
        assertEquals(404, a.owner().get("/api/trips/" + b.tripId() + "/ideas").statusCode());
        assertEquals(404, cast(a.people().get(1), inB, 1).statusCode());
    }

    @Test
    void onlyTheProposerOrTheOwnerCanEditRuleOutOrDelete() throws Exception {
        Group g = group(3);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2);
        String jonasIdea = add(jonas, g.tripId(), vote("Jonas's idea"));
        String path = "/api/ideas/" + jonasIdea;

        for (HttpResponse<String> response : List.of(
                mia.patch(path, "{\"title\":\"Mine now\"}"),
                mia.put(path + "/status", "{\"status\":\"rejected\"}"),
                mia.delete(path))) {
            assertEquals(403, response.statusCode(), response.body());
            assertEquals("forbidden", code(response));
        }
        assertEquals("Jonas's idea", field(idea(mia, g.tripId(), jonasIdea), "title"));

        assertEquals(200, jonas.patch(path, "{\"title\":\"Still mine\"}").statusCode());
        assertEquals("Still mine", field(idea(mia, g.tripId(), jonasIdea), "title"));
        assertEquals(200, priya.patch(path, "{\"description\":\"The owner can too\"}").statusCode());

        HttpResponse<String> ruledOut = priya.put(path + "/status", "{\"status\":\"rejected\"}");
        assertEquals(200, ruledOut.statusCode(), ruledOut.body());
        assertEquals("rejected", field(ruledOut.body(), "status"));

        // A vote on something ruled out is kept but does not bring it back.
        assertEquals(204, cast(mia, jonasIdea, 1).statusCode());
        assertEquals("rejected", status(mia, g.tripId(), jonasIdea));

        // Putting it back counts the votes again: Jonas and Mia are two of three.
        HttpResponse<String> back = jonas.put(path + "/status", "{\"status\":\"voting\"}");
        assertEquals("agreed", field(back.body(), "status"));
        assertEquals(List.of(jonas.id, mia.id), going(back.body()));

        assertEquals(204, priya.delete(path).statusCode());
        assertEquals(404, priya.delete(path).statusCode());
        assertEquals(404, cast(mia, jonasIdea, 1).statusCode());
        assertEquals("[]", priya.get("/api/trips/" + g.tripId() + "/votes").body(), "its votes went with it");
    }

    @Test
    void theStatusOfAnActivityCanOnlyBeSetToRejectedOrVoting() throws Exception {
        Group g = group(2);
        Person priya = g.owner();
        String voted = add(priya, g.tripId(), vote("Kayak"));
        String planned = add(priya, g.tripId(), plan("Lunch", START, priya.id));

        for (String bad : List.of("agreed", "planned", "banana")) {
            HttpResponse<String> response = priya.put("/api/ideas/" + voted + "/status", "{\"status\":\"" + bad + "\"}");
            assertEquals(400, response.statusCode(), bad);
            assertEquals("Status has to be rejected or voting.", field(response.body(), "message"));
        }
        assertEquals(400, priya.put("/api/ideas/" + voted + "/status", "{}").statusCode());
        assertEquals(400, priya.put("/api/ideas/" + planned + "/status", "{\"status\":\"rejected\"}").statusCode());
        assertEquals("voting", status(priya, g.tripId(), voted));
        assertEquals("planned", status(priya, g.tripId(), planned));
    }

    @Test
    void editingChangesOnlyWhatIsSentAndNeverTheStatusOrTheProposer() throws Exception {
        Group g = group(2);
        Person priya = g.owner(), jonas = g.people().get(1);
        String ideaId = add(priya, g.tripId(), plan("Lunch", START, priya.id));
        String path = "/api/ideas/" + ideaId;

        HttpResponse<String> edited = priya.patch(path, "{\"title\":\"  Late lunch \",\"category\":\"travel\",\"allDay\":true,"
                + "\"status\":\"rejected\",\"proposedBy\":\"" + jonas.id + "\",\"attendeeIds\":[\"" + jonas.id + "\"]}");
        assertEquals(200, edited.statusCode(), edited.body());
        assertEquals("Late lunch", field(edited.body(), "title"));
        assertEquals("travel", field(edited.body(), "category"));
        assertTrue(edited.body().contains("\"allDay\":true"));
        assertEquals("planned", field(edited.body(), "status"));
        assertEquals(priya.id, field(edited.body(), "proposedBy"));
        assertEquals(List.of(jonas.id), going(edited.body()));
        assertTrue(edited.body().contains("\"proposedStart\":\"2026-11-08T05:30:00"), "a time not mentioned is left alone");

        HttpResponse<String> noDate = priya.patch(path, "{\"proposedStart\":null}");
        assertEquals(400, noDate.statusCode());
        assertEquals("Pick a date and time.", field(noDate.body(), "message"));
        assertEquals(400, priya.patch(path, "{\"title\":\"   \"}").statusCode());
        assertEquals(400, priya.patch(path, "{\"title\":5}").statusCode());
        assertEquals(400, priya.patch(path, "{\"attendeeIds\":[\"" + UUID.randomUUID() + "\"]}").statusCode());
        assertEquals("Late lunch", field(idea(jonas, g.tripId(), ideaId), "title"));

        // One that was voted in may lose its date: it then needs one.
        String voted = add(priya, g.tripId(), vote("Kayak").replace("\"proposedStart\":null", "\"proposedStart\":\"" + START + "\""));
        assertTrue(priya.patch("/api/ideas/" + voted, "{\"proposedStart\":null}").body().contains("\"proposedStart\":null"));
    }

    /* Leaving */

    @Test
    void whenSomeoneLeavesTheirVotesAndGoingLeaveToo() throws Exception {
        Group g = group(4);
        Person priya = g.owner(), jonas = g.people().get(1), mia = g.people().get(2), ethan = g.people().get(3);
        // Four people: three carry it.
        String a = add(priya, g.tripId(), vote("A"));
        assertEquals(204, cast(jonas, a, 1).statusCode());
        String c = add(priya, g.tripId(), vote("C"));
        assertEquals(204, cast(mia, c, 1).statusCode());
        assertEquals(204, cast(ethan, c, -1).statusCode());
        String p = add(priya, g.tripId(), plan("P", START, ethan.id, mia.id, priya.id));
        String r = add(ethan, g.tripId(), vote("R"));
        assertEquals(200, ethan.put("/api/ideas/" + r + "/status", "{\"status\":\"rejected\"}").statusCode());
        assertEquals("voting", status(priya, g.tripId(), a));
        assertEquals("voting", status(priya, g.tripId(), c));

        assertEquals(204, ethan.delete("/api/trips/" + g.tripId() + "/members/" + ethan.id).statusCode());

        // Three left: two carry it.
        assertEquals("agreed", status(priya, g.tripId(), a));
        assertEquals(List.of(priya.id, jonas.id), going(idea(priya, g.tripId(), a)));
        assertEquals("agreed", status(priya, g.tripId(), c));
        assertEquals(List.of(priya.id, mia.id), going(idea(priya, g.tripId(), c)));
        assertEquals(List.of(mia.id, priya.id), going(idea(priya, g.tripId(), p)));
        assertEquals("rejected", status(priya, g.tripId(), r));
        assertEquals(ethan.id, field(idea(priya, g.tripId(), r), "proposedBy"), "what they proposed stays");
        assertFalse(priya.get("/api/trips/" + g.tripId() + "/votes").body().contains(ethan.id));

        // The owner removes Mia: two left, and C loses a vote for it.
        assertEquals(204, priya.delete("/api/trips/" + g.tripId() + "/members/" + mia.id).statusCode());
        assertEquals("voting", status(priya, g.tripId(), c));
        assertEquals(List.of(priya.id), going(idea(priya, g.tripId(), c)));
        assertEquals("agreed", status(priya, g.tripId(), a));

        // Neither can see the trip's activities any more.
        assertEquals(404, ethan.get("/api/trips/" + g.tripId() + "/ideas").statusCode());
        assertEquals(404, cast(mia, a, 1).statusCode());

        // Coming back starts clean.
        join(mia, g.tripId(), priya);
        assertFalse(priya.get("/api/trips/" + g.tripId() + "/votes").body().contains(mia.id));
        assertEquals(List.of(priya.id), going(idea(mia, g.tripId(), c)));
    }

    @Test
    void peopleJoiningDoNotUndoWhatWasCarriedUntilTheNextVote() throws Exception {
        Group g = group(2);
        Person priya = g.owner(), jonas = g.people().get(1);
        String ideaId = add(priya, g.tripId(), vote("Kayak"));
        assertEquals(204, cast(jonas, ideaId, 1).statusCode());
        assertEquals("agreed", status(priya, g.tripId(), ideaId));

        join(person("Mia"), g.tripId(), priya);
        join(person("Ethan"), g.tripId(), priya);
        assertEquals("agreed", status(priya, g.tripId(), ideaId), "two of four is not enough now, but nothing recounted it");

        assertEquals(204, cast(jonas, ideaId, 1).statusCode());
        assertEquals("voting", status(priya, g.tripId(), ideaId), "the next vote counts it against four");
    }

    /* The same moment */

    @Test
    void sixPeopleVotingForItAtTheSameMomentCarryItWithOneVoteEach() throws Exception {
        for (int round = 0; round < 3; round++) {
            Group g = group(6);
            warmUp(g);
            String ideaId = add(g.owner(), g.tripId(), vote("Kayak"));
            List<Callable<Integer>> actions = new ArrayList<>();
            for (int i = 1; i < 6; i++) {
                Person voter = g.people().get(i);
                actions.add(() -> cast(voter, ideaId, 1).statusCode());
            }

            assertEquals(List.of(204, 204, 204, 204, 204), together(actions));
            assertEquals(6, votesOn(g.owner(), g.tripId(), ideaId).size());
            String carried = idea(g.owner(), g.tripId(), ideaId);
            assertEquals("agreed", field(carried, "status"));
            // Four of the six carry it. Those four are marked as going at that moment, one at a time,
            // and the two who agreed after that are left to say they are in themselves.
            List<String> marked = going(carried);
            assertEquals(4, marked.size(), carried);
            assertEquals(4, marked.stream().distinct().count(), "none twice");
        }
    }

    @Test
    void mixedVotesAtTheSameMomentLeaveTheStatusMatchingTheCount() throws Exception {
        for (int round = 0; round < 3; round++) {
            Group g = group(5); // three carry it
            warmUp(g);
            Person owner = g.owner();
            String ideaId = add(owner, g.tripId(), vote("Kayak"));
            List<Callable<Integer>> actions = new ArrayList<>();
            for (int i = 1; i < 5; i++) {
                Person voter = g.people().get(i);
                int value = i % 2 == 0 ? -1 : 1; // two for, two against, besides the owner's own vote
                actions.add(() -> cast(voter, ideaId, value).statusCode());
            }

            together(actions);
            List<String> votes = votesOn(owner, g.tripId(), ideaId);
            long agree = votes.stream().filter(v -> v.contains("\"value\":1")).count();
            assertEquals(5, votes.size());
            assertEquals(3, agree);
            assertEquals("agreed", status(owner, g.tripId(), ideaId));
        }
    }

    @Test
    void theSamePersonsFirstVoteSentTwiceAtOnceIsOneVote() throws Exception {
        for (int round = 0; round < 5; round++) {
            Group g = group(3);
            warmUp(g);
            Person jonas = g.people().get(1);
            String ideaId = add(g.owner(), g.tripId(), vote("Kayak"));

            List<Integer> statuses = together(List.of(
                    () -> cast(jonas, ideaId, 1).statusCode(),
                    () -> cast(jonas, ideaId, 1).statusCode()));

            assertEquals(List.of(204, 204), statuses);
            assertEquals(2, votesOn(jonas, g.tripId(), ideaId).size());
        }
    }

    @Test
    void sayingYoureInTwiceAtOnceIsOnePlace() throws Exception {
        for (int round = 0; round < 5; round++) {
            Group g = group(2);
            warmUp(g);
            Person jonas = g.people().get(1);
            String ideaId = add(g.owner(), g.tripId(), plan("Lunch", START, g.owner().id));

            List<Integer> statuses = together(List.of(
                    () -> jonas.put("/api/ideas/" + ideaId + "/attendance", "{\"attending\":true}").statusCode(),
                    () -> jonas.put("/api/ideas/" + ideaId + "/attendance", "{\"attending\":true}").statusCode()));

            assertEquals(List.of(200, 200), statuses);
            assertEquals(List.of(g.owner().id, jonas.id), going(idea(jonas, g.tripId(), ideaId)));
        }
    }

    @Test
    void aVoteAndAPersonLeavingAtTheSameMomentLeaveAConsistentCount() throws Exception {
        for (int round = 0; round < 5; round++) {
            Group g = group(5);
            Person priya = g.owner(), jonas = g.people().get(1), ethan = g.people().get(3), spare = g.people().get(4);
            warmUp(g);
            // A first person leaves on their own, which warms up that path too. Four are left: three carry it.
            assertEquals(204, spare.delete("/api/trips/" + g.tripId() + "/members/" + spare.id).statusCode());
            String ideaId = add(priya, g.tripId(), vote("Kayak"));

            together(List.of(
                    () -> cast(jonas, ideaId, 1).statusCode(),
                    () -> ethan.delete("/api/trips/" + g.tripId() + "/members/" + ethan.id).statusCode()));

            // With Ethan gone three are left and two carry it. Whichever came first, it ends up counted
            // against the three: Priya and Jonas are two of three, so it is carried.
            assertEquals("agreed", status(priya, g.tripId(), ideaId));
            assertEquals(List.of(priya.id, jonas.id), going(idea(priya, g.tripId(), ideaId)));
        }
    }
}
