package com.voyager.backend.chat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.net.http.WebSocketHandshakeException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;

// Runs the real server on a random port. Every person is a separate signed-in client with their own
// cookie jar. The REST tests check who can read and write what; the socket tests open a real
// WebSocket as each person (the JDK's own client, carrying the login cookie) and check who is told.

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ChatFlowTests {

    private static final String TRIP_BODY = "{\"name\":\"Great Ocean Road\",\"destination\":\"Victoria\"}";
    private static final long WAIT_SECONDS = 5;

    @Autowired
    private Environment environment;

    private String port;
    private String base;
    private final List<Socket> openSockets = new ArrayList<>();

    @BeforeEach
    void setUp() {
        port = environment.getProperty("local.server.port");
        base = "http://localhost:" + port;
    }

    @AfterEach
    void closeSockets() {
        for (Socket socket : openSockets) {
            socket.close();
        }
        openSockets.clear();
    }

    /* A signed-in person */

    private final class Person {
        final CookieManager cookies = new CookieManager();
        final HttpClient client = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .cookieHandler(cookies)
                .build();
        final String id;
        final String email;

        // register=false gives someone who is not signed in.
        Person(String displayName, boolean register) throws Exception {
            if (register) {
                email = "c-" + UUID.randomUUID() + "@example.com";
                HttpResponse<String> response = post("/api/auth/register",
                        "{\"displayName\":\"" + displayName + "\",\"email\":\"" + email + "\",\"password\":\"hunter22\"}");
                assertEquals(201, response.statusCode(), response.body());
                id = field(response.body(), "id");
            } else {
                id = null;
                email = null;
            }
        }

        // The same account signed in again with its own cookie jar: a second phone or laptop.
        private Person(Person other) throws Exception {
            id = other.id;
            email = other.email;
            HttpResponse<String> response = post("/api/auth/login",
                    "{\"email\":\"" + email + "\",\"password\":\"hunter22\"}");
            assertEquals(200, response.statusCode(), response.body());
        }

        Person anotherDevice() throws Exception {
            return new Person(this);
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
        HttpResponse<String> delete(String path) throws Exception { return send("DELETE", path, null); }

        // The cookies this person's browser would send with a socket handshake.
        String cookieHeader() {
            return cookies.getCookieStore().getCookies().stream()
                    .map(cookie -> cookie.getName() + "=" + cookie.getValue())
                    .collect(Collectors.joining("; "));
        }

        // Opens /ws/chat as this person. The origin is what a page on this server would send.
        Socket openSocket(String origin) throws Exception {
            Socket socket = new Socket(this, origin);
            openSockets.add(socket);
            return socket;
        }

        Socket openSocket() throws Exception {
            return openSocket("http://localhost:" + port);
        }
    }

    private Person person(String displayName) throws Exception {
        return new Person(displayName, true);
    }

    /* A WebSocket */

    private final class Socket implements WebSocket.Listener {
        final BlockingQueue<String> frames = new LinkedBlockingQueue<>();
        final CompletableFuture<WebSocket> ready;
        // Completes with the close code when the server (or anyone) closes the socket.
        final CompletableFuture<Integer> closed = new CompletableFuture<>();
        private final StringBuilder partial = new StringBuilder();

        Socket(Person person, String origin) {
            WebSocket.Builder builder = person.client.newWebSocketBuilder()
                    .header("Origin", origin);
            String cookie = person.cookieHeader();
            if (!cookie.isEmpty()) {
                builder.header("Cookie", cookie);
            }
            ready = builder.buildAsync(URI.create("ws://localhost:" + port + "/ws/chat"), this);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            partial.append(data);
            if (last) {
                frames.add(partial.toString());
                partial.setLength(0);
            }
            webSocket.request(1);
            return null;
        }

        @Override
        public void onOpen(WebSocket webSocket) {
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            closed.complete(statusCode);
            return null;
        }

        WebSocket connected() throws Exception {
            return ready.get(WAIT_SECONDS, TimeUnit.SECONDS);
        }

        void send(String json) throws Exception {
            connected().sendText(json, true).get(WAIT_SECONDS, TimeUnit.SECONDS);
        }

        void subscribe(String channelId) throws Exception {
            send("{\"type\":\"subscribe\",\"channelId\":\"" + channelId + "\"}");
        }

        // The next frame the server sends, waiting a little for it.
        String next() throws Exception {
            String frame = frames.poll(WAIT_SECONDS, TimeUnit.SECONDS);
            assertNotNull(frame, "no frame from the server within " + WAIT_SECONDS + "s");
            return frame;
        }

        // For "this person is not told": give the server a moment, then check nothing came.
        void expectSilence() throws Exception {
            assertNull(frames.poll(700, TimeUnit.MILLISECONDS), "expected nothing, but the server sent a frame");
        }

        // The status code of a refused handshake.
        int refusedWith() throws Exception {
            ExecutionException error = assertThrows(ExecutionException.class,
                    () -> ready.get(WAIT_SECONDS, TimeUnit.SECONDS));
            WebSocketHandshakeException refusal = assertInstanceOf(WebSocketHandshakeException.class, error.getCause());
            return refusal.getResponse().statusCode();
        }

        void close() {
            if (ready.isDone() && !ready.isCompletedExceptionally()) {
                ready.join().abort();
            }
        }
    }

    /* Small helpers */

    // The first value of a string field in a JSON body. Enough for these flat responses.
    private static String field(String json, String name) {
        Matcher matcher = Pattern.compile("\"" + name + "\":\"([^\"]*)\"").matcher(json);
        assertTrue(matcher.find(), "no \"" + name + "\" in " + json);
        return matcher.group(1);
    }

    // Every "id" in a list body, in order.
    private static List<String> ids(String json) {
        Matcher matcher = Pattern.compile("\"id\":\"([^\"]*)\"").matcher(json);
        List<String> found = new ArrayList<>();
        while (matcher.find()) {
            found.add(matcher.group(1));
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

    private void join(Person member, String tripId, Person owner) throws Exception {
        String code = field(owner.get("/api/trips/" + tripId).body(), "inviteCode");
        assertEquals(200, member.post("/api/trips/join/" + code, null).statusCode());
    }

    // The id of the trip's one channel, as seen by this person.
    private String channelOf(Person person, String tripId) throws Exception {
        HttpResponse<String> response = person.get("/api/trips/" + tripId + "/channels");
        assertEquals(200, response.statusCode(), response.body());
        List<String> found = ids(response.body());
        assertEquals(1, found.size(), response.body());
        return found.get(0);
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

    private static String say(String text) {
        return "{\"body\":\"" + text + "\"}";
    }

    private HttpResponse<String> sendMessage(Person person, String channelId, String text) throws Exception {
        return person.post("/api/channels/" + channelId + "/messages", say(text));
    }

    /* Channels */

    @Test
    void everyTripStartsWithAGeneralChannel() throws Exception {
        Person priya = person("Priya");
        String tripId = createTrip(priya);

        HttpResponse<String> response = priya.get("/api/trips/" + tripId + "/channels");

        assertEquals(200, response.statusCode(), response.body());
        assertEquals(1, ids(response.body()).size(), response.body());
        assertEquals("general", field(response.body(), "name"));
        assertEquals(tripId, field(response.body(), "tripId"));
    }

    @Test
    void aMemberWhoJoinsLaterSeesTheSameChannel() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        String tripId = createTrip(priya);
        join(jonas, tripId, priya);

        assertEquals(channelOf(priya, tripId), channelOf(jonas, tripId));
    }

    /* Who can get in */

    @Test
    void aChatIsInvisibleToPeopleWhoAreNotOnTheTrip() throws Exception {
        Person priya = person("Priya");
        Person stranger = person("Stranger");
        String tripId = createTrip(priya);
        String channelId = channelOf(priya, tripId);
        assertEquals(201, sendMessage(priya, channelId, "private plans").statusCode());

        assertEquals(404, stranger.get("/api/trips/" + tripId + "/channels").statusCode());

        HttpResponse<String> list = stranger.get("/api/channels/" + channelId + "/messages");
        assertEquals(404, list.statusCode());
        assertEquals("not_found", code(list));
        assertFalse(list.body().contains("private plans"));

        assertEquals(404, sendMessage(stranger, channelId, "let me in").statusCode());
        assertEquals(404, stranger.get("/api/channels/" + channelId + "/read-state").statusCode());
        assertEquals(404, stranger.post("/api/channels/" + channelId + "/read", null).statusCode());

        // The stranger's attempt wrote nothing.
        assertEquals(1, ids(priya.get("/api/channels/" + channelId + "/messages").body()).size());
    }

    @Test
    void aChannelThatDoesNotExistIsA404() throws Exception {
        Person priya = person("Priya");

        assertEquals(404, priya.get("/api/channels/" + UUID.randomUUID() + "/messages").statusCode());
        assertEquals(404, priya.get("/api/channels/not-an-id/messages").statusCode());
        assertEquals(404, priya.get("/api/trips/" + UUID.randomUUID() + "/channels").statusCode());
    }

    @Test
    void signedOutRequestsGetA401() throws Exception {
        Person priya = person("Priya");
        Person nobody = new Person("Nobody", false);
        String tripId = createTrip(priya);
        String channelId = channelOf(priya, tripId);

        assertEquals(401, nobody.get("/api/trips/" + tripId + "/channels").statusCode());
        assertEquals(401, nobody.get("/api/channels/" + channelId + "/messages").statusCode());
        assertEquals(401, sendMessage(nobody, channelId, "hello").statusCode());
        assertEquals(401, nobody.get("/api/channels/" + channelId + "/read-state").statusCode());
        assertEquals(401, nobody.post("/api/channels/" + channelId + "/read", null).statusCode());
    }

    /* Sending and reading */

    @Test
    void messagesAreSavedTrimmedAndEveryoneOnTheTripSeesThemInOrder() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        String tripId = createTrip(priya);
        join(jonas, tripId, priya);
        String channelId = channelOf(priya, tripId);

        HttpResponse<String> first = sendMessage(priya, channelId, "  Petrol stop at Colac?  ");
        assertEquals(201, first.statusCode(), first.body());
        assertEquals("Petrol stop at Colac?", field(first.body(), "body"));
        assertEquals(priya.id, field(first.body(), "authorId"));
        assertEquals(channelId, field(first.body(), "channelId"));
        String firstId = field(first.body(), "id");
        String secondId = field(sendMessage(jonas, channelId, "Yes please").body(), "id");

        for (Person who : List.of(priya, jonas)) {
            HttpResponse<String> list = who.get("/api/channels/" + channelId + "/messages");
            assertEquals(200, list.statusCode(), list.body());
            assertEquals(List.of(firstId, secondId), ids(list.body()));
            assertTrue(list.body().contains("Petrol stop at Colac?"));
        }
    }

    @Test
    void emptyAndOversizedMessagesAreRefusedWithAMessageToShow() throws Exception {
        Person priya = person("Priya");
        String channelId = channelOf(priya, createTrip(priya));

        HttpResponse<String> blank = sendMessage(priya, channelId, "   ");
        assertEquals(400, blank.statusCode());
        assertEquals("invalid", code(blank));
        assertEquals("Type something first.", field(blank.body(), "message"));

        HttpResponse<String> missing = priya.post("/api/channels/" + channelId + "/messages", "{}");
        assertEquals(400, missing.statusCode());
        assertEquals("Type something first.", field(missing.body(), "message"));

        assertEquals(400, priya.post("/api/channels/" + channelId + "/messages", "not json").statusCode());

        HttpResponse<String> tooLong = sendMessage(priya, channelId, "x".repeat(2001));
        assertEquals(400, tooLong.statusCode());
        assertTrue(field(tooLong.body(), "message").contains("too long"));

        assertEquals(201, sendMessage(priya, channelId, "x".repeat(2000)).statusCode());
        assertEquals(1, ids(priya.get("/api/channels/" + channelId + "/messages").body()).size());
    }

    @Test
    void anotherTripsChatIsNotMixedIn() throws Exception {
        Person priya = person("Priya");
        String first = channelOf(priya, createTrip(priya));
        String second = channelOf(priya, createTrip(priya));
        sendMessage(priya, first, "one");
        sendMessage(priya, second, "two");

        assertTrue(priya.get("/api/channels/" + first + "/messages").body().contains("one"));
        assertFalse(priya.get("/api/channels/" + first + "/messages").body().contains("two"));
    }

    /* What each person has read */

    @Test
    void unreadCountsAndTheDividerFollowWhatEachPersonHasRead() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        String tripId = createTrip(priya);
        join(jonas, tripId, priya);
        String channelId = channelOf(priya, tripId);

        String firstId = field(sendMessage(priya, channelId, "one").body(), "id");
        sendMessage(priya, channelId, "two");

        // Jonas has read nothing, so he has two unread and the divider goes above the first.
        String jonasState = jonas.get("/api/channels/" + channelId + "/read-state").body();
        assertTrue(jonasState.contains("\"unreadCount\":2"), jonasState);
        assertEquals(firstId, field(jonasState, "firstUnreadId"));
        // Your own messages are never unread to you.
        String priyaState = priya.get("/api/channels/" + channelId + "/read-state").body();
        assertTrue(priyaState.contains("\"unreadCount\":0"), priyaState);
        assertTrue(priyaState.contains("\"firstUnreadId\":null"), priyaState);

        assertEquals(204, jonas.post("/api/channels/" + channelId + "/read", null).statusCode());
        String cleared = jonas.get("/api/channels/" + channelId + "/read-state").body();
        assertTrue(cleared.contains("\"unreadCount\":0") && cleared.contains("\"firstUnreadId\":null"), cleared);

        // New things after reading are unread again, straight away: no pause is needed, because a message
        // is always stamped later than the newest one before it. Priya's own position is untouched by his reading.
        String newId = field(sendMessage(priya, channelId, "three").body(), "id");
        String later = jonas.get("/api/channels/" + channelId + "/read-state").body();
        assertTrue(later.contains("\"unreadCount\":1"), later);
        assertEquals(newId, field(later, "firstUnreadId"));

        // His own reply does not count against him, but it does count for Priya.
        sendMessage(jonas, channelId, "four");
        assertTrue(jonas.get("/api/channels/" + channelId + "/read-state").body().contains("\"unreadCount\":1"));
        assertTrue(priya.get("/api/channels/" + channelId + "/read-state").body().contains("\"unreadCount\":1"));
    }

    @Test
    void whatYouHaveReadIsKeptOnTheServerSoReadingOnOneDeviceClearsTheOther() throws Exception {
        Person priya = person("Priya");
        Person jonasLaptop = person("Jonas");
        String tripId = createTrip(priya);
        join(jonasLaptop, tripId, priya);
        String channelId = channelOf(priya, tripId);
        Person jonasPhone = jonasLaptop.anotherDevice();
        sendMessage(priya, channelId, "hello");

        assertTrue(jonasPhone.get("/api/channels/" + channelId + "/read-state").body().contains("\"unreadCount\":1"));
        assertEquals(204, jonasLaptop.post("/api/channels/" + channelId + "/read", null).statusCode());
        assertTrue(jonasPhone.get("/api/channels/" + channelId + "/read-state").body().contains("\"unreadCount\":0"));
        // Marking read twice is fine.
        assertEquals(204, jonasLaptop.post("/api/channels/" + channelId + "/read", null).statusCode());
    }

    @Test
    void readingAnEmptyChatChangesNothingAndTheFirstMessageIsStillNew() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        String tripId = createTrip(priya);
        join(jonas, tripId, priya);
        String channelId = channelOf(priya, tripId);

        assertEquals(204, jonas.post("/api/channels/" + channelId + "/read", null).statusCode());
        sendMessage(priya, channelId, "first!");

        assertTrue(jonas.get("/api/channels/" + channelId + "/read-state").body().contains("\"unreadCount\":1"));
    }

    @Test
    void twoDevicesMarkingAChatReadForTheFirstTimeAtTheSameMomentBothSucceed() throws Exception {
        for (int round = 0; round < 5; round++) {
            Person priya = person("Priya");
            Person jonasLaptop = person("Jonas");
            String tripId = createTrip(priya);
            join(jonasLaptop, tripId, priya);
            String channelId = channelOf(priya, tripId);
            Person jonasPhone = jonasLaptop.anotherDevice();
            sendMessage(priya, channelId, "hello");

            List<Integer> statuses = together(List.of(
                    () -> jonasLaptop.post("/api/channels/" + channelId + "/read", null).statusCode(),
                    () -> jonasPhone.post("/api/channels/" + channelId + "/read", null).statusCode()));

            assertEquals(List.of(204, 204), statuses);
            assertTrue(jonasLaptop.get("/api/channels/" + channelId + "/read-state").body().contains("\"unreadCount\":0"));
        }
    }

    @Test
    void messagesSentAtTheSameMomentAllArriveInOneConsistentOrder() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        String tripId = createTrip(priya);
        join(jonas, tripId, priya);
        String channelId = channelOf(priya, tripId);

        List<Integer> statuses = together(List.of(
                () -> sendMessage(priya, channelId, "p1").statusCode(),
                () -> sendMessage(jonas, channelId, "j1").statusCode(),
                () -> sendMessage(priya, channelId, "p2").statusCode(),
                () -> sendMessage(jonas, channelId, "j2").statusCode()));

        assertEquals(List.of(201, 201, 201, 201), statuses);
        // Four messages, and each person is told about exactly the other's two: nothing lost, nothing counted twice.
        assertEquals(4, ids(priya.get("/api/channels/" + channelId + "/messages").body()).size());
        assertTrue(priya.get("/api/channels/" + channelId + "/read-state").body().contains("\"unreadCount\":2"));
        assertTrue(jonas.get("/api/channels/" + channelId + "/read-state").body().contains("\"unreadCount\":2"));
    }

    /* Leaving */

    @Test
    void leavingTheTripEndsAccessButTheHistoryStaysForTheOthers() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        String tripId = createTrip(priya);
        join(jonas, tripId, priya);
        String channelId = channelOf(priya, tripId);
        sendMessage(jonas, channelId, "see you at the beach");

        assertEquals(204, jonas.delete("/api/trips/" + tripId + "/members/" + jonas.id).statusCode());

        assertEquals(404, jonas.get("/api/channels/" + channelId + "/messages").statusCode());
        assertEquals(404, sendMessage(jonas, channelId, "still here?").statusCode());
        HttpResponse<String> history = priya.get("/api/channels/" + channelId + "/messages");
        assertTrue(history.body().contains("see you at the beach"));
        assertEquals(jonas.id, field(history.body(), "authorId"));
    }

    /* The socket */

    @Test
    void everyoneListeningToAChannelIsToldWhenAMessageIsSavedAndCanThenFetchIt() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        String tripId = createTrip(priya);
        join(jonas, tripId, priya);
        String channelId = channelOf(priya, tripId);
        Socket priyaSocket = priya.openSocket();
        Socket jonasSocket = jonas.openSocket();
        priyaSocket.subscribe(channelId);
        jonasSocket.subscribe(channelId);
        assertEquals("{\"type\":\"subscribed\",\"channelId\":\"" + channelId + "\"}", priyaSocket.next());
        assertEquals("{\"type\":\"subscribed\",\"channelId\":\"" + channelId + "\"}", jonasSocket.next());

        String messageId = field(sendMessage(priya, channelId, "Leaving at eight").body(), "id");

        String expected = "{\"type\":\"message\",\"channelId\":\"" + channelId + "\",\"messageId\":\"" + messageId + "\"}";
        assertEquals(expected, jonasSocket.next());
        assertEquals(expected, priyaSocket.next());
        // By the time they are told, it can already be read: the nudge only goes out after the save.
        assertTrue(jonas.get("/api/channels/" + channelId + "/messages").body().contains("Leaving at eight"));
    }

    @Test
    void aSocketOnlyHearsAboutTheChannelsItSubscribedTo() throws Exception {
        Person priya = person("Priya");
        String first = channelOf(priya, createTrip(priya));
        String second = channelOf(priya, createTrip(priya));
        Socket socket = priya.openSocket();
        socket.subscribe(first);
        socket.next();

        sendMessage(priya, second, "somewhere else");

        socket.expectSilence();
    }

    @Test
    void unsubscribingStopsTheNudges() throws Exception {
        Person priya = person("Priya");
        String channelId = channelOf(priya, createTrip(priya));
        Socket socket = priya.openSocket();
        socket.subscribe(channelId);
        socket.next();

        socket.send("{\"type\":\"unsubscribe\",\"channelId\":\"" + channelId + "\"}");
        Thread.sleep(200);
        sendMessage(priya, channelId, "anyone there");

        socket.expectSilence();
    }

    @Test
    void someoneOutsideTheTripCannotListenToItsChat() throws Exception {
        Person priya = person("Priya");
        Person stranger = person("Stranger");
        String channelId = channelOf(priya, createTrip(priya));
        Socket socket = stranger.openSocket();

        socket.subscribe(channelId);
        assertEquals("{\"type\":\"error\",\"code\":\"not_found\",\"channelId\":\"" + channelId + "\"}", socket.next());
        sendMessage(priya, channelId, "members only");

        socket.expectSilence();
    }

    @Test
    void aMemberWhoLeavesStopsBeingToldEvenWithTheSocketStillOpen() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        String tripId = createTrip(priya);
        join(jonas, tripId, priya);
        String channelId = channelOf(priya, tripId);
        Socket jonasSocket = jonas.openSocket();
        jonasSocket.subscribe(channelId);
        jonasSocket.next();

        assertEquals(204, jonas.delete("/api/trips/" + tripId + "/members/" + jonas.id).statusCode());
        sendMessage(priya, channelId, "he has gone");

        jonasSocket.expectSilence();
    }

    @Test
    void theSocketAnswersPingsAndRefusesNonsense() throws Exception {
        Person priya = person("Priya");
        Socket socket = priya.openSocket();

        socket.send("{\"type\":\"ping\"}");
        assertEquals("{\"type\":\"pong\"}", socket.next());

        socket.send("hello");
        assertEquals("{\"type\":\"error\",\"code\":\"invalid\"}", socket.next());
        socket.send("{\"type\":\"dance\"}");
        assertEquals("{\"type\":\"error\",\"code\":\"invalid\"}", socket.next());
        socket.send("{\"type\":\"subscribe\",\"channelId\":\"not-a-uuid\"}");
        assertEquals("{\"type\":\"error\",\"code\":\"invalid\"}", socket.next());
        socket.send("{\"type\":\"subscribe\"}");
        assertEquals("{\"type\":\"error\",\"code\":\"invalid\"}", socket.next());

        // Still usable afterwards.
        socket.send("{\"type\":\"ping\"}");
        assertEquals("{\"type\":\"pong\"}", socket.next());
    }

    @Test
    void theSocketNeedsALoginAndATrustedOrigin() throws Exception {
        Person priya = person("Priya");
        Person nobody = new Person("Nobody", false);

        assertEquals(401, nobody.openSocket().refusedWith());
        // A page on another site cannot borrow a visitor's cookie to listen in.
        assertEquals(403, priya.openSocket("http://evil.example").refusedWith());
    }

    @Test
    void signingOutClosesTheSocketsOfThatSessionAndOnlyThose() throws Exception {
        Person laptop = person("Priya");
        Person phone = laptop.anotherDevice();
        String channelId = channelOf(laptop, createTrip(laptop));
        Socket laptopSocket = laptop.openSocket();
        Socket phoneSocket = phone.openSocket();
        laptopSocket.subscribe(channelId);
        laptopSocket.next();
        phoneSocket.subscribe(channelId);
        phoneSocket.next();

        assertEquals(204, laptop.post("/api/auth/logout", null).statusCode());

        // The laptop's socket is closed by the server, with "policy violation" (1008).
        assertEquals(1008, laptopSocket.closed.get(WAIT_SECONDS, TimeUnit.SECONDS).intValue());
        // The phone is a different session, so it is still connected and still hears things.
        phoneSocket.send("{\"type\":\"ping\"}");
        assertEquals("{\"type\":\"pong\"}", phoneSocket.next());
        assertFalse(phoneSocket.closed.isDone());
    }

    @Test
    void aSocketThatIsClosedIsNoLongerToldAnything() throws Exception {
        Person priya = person("Priya");
        Person jonas = person("Jonas");
        String tripId = createTrip(priya);
        join(jonas, tripId, priya);
        String channelId = channelOf(priya, tripId);
        Socket jonasSocket = jonas.openSocket();
        jonasSocket.subscribe(channelId);
        jonasSocket.next();
        jonas.post("/api/auth/logout", null);
        jonasSocket.closed.get(WAIT_SECONDS, TimeUnit.SECONDS);

        // Sending still works for everyone else, and the closed socket gets nothing.
        assertEquals(201, sendMessage(priya, channelId, "after he signed out").statusCode());
        jonasSocket.expectSilence();
    }
}
