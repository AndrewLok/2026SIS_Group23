package com.voyager.backend;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.voyager.backend.demo.DemoData;

/**
 * The demo, end to end over HTTP, against the seeded trip. Each test starts from a fresh seed
 * and signs in as the demo user (usr-lachlan, the trip owner).
 */
@SpringBootTest
@AutoConfigureMockMvc
class DemoFlowTest {

    private static final String TRIP = "trip-gor";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private DemoData demoData;

    private MockHttpSession session;

    @BeforeEach
    void signInToAFreshDemo() throws Exception {
        demoData.reset();
        session = new MockHttpSession();
        mvc.perform(post("/api/auth/demo").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("usr-lachlan"));
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, String body) {
        return request.session(session).contentType(MediaType.APPLICATION_JSON).content(body);
    }

    @Test
    void sessionSurvivesAndSignOutEndsIt() throws Exception {
        mvc.perform(get("/api/auth/session").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Lachlan Fawle"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        mvc.perform(post("/api/auth/logout").session(session)).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/session").session(session)).andExpect(status().isNoContent());
        mvc.perform(get("/api/trips").session(session))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("forbidden"));
    }

    @Test
    void wrongPasswordIsInvalidCredentials() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"priya@example.com\",\"password\":\"nope\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("invalid_credentials"));
    }

    @Test
    void theSeededTripLooksLikeTheMock() throws Exception {
        mvc.perform(get("/api/trips").session(session))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(TRIP))
                .andExpect(jsonPath("$[0].inviteCode").value("GOR27X"))
                .andExpect(jsonPath("$[0].allowanceCents").value(25_000));
        mvc.perform(get("/api/trips/{id}/members", TRIP).session(session))
                .andExpect(jsonPath("$", hasSize(5)))
                .andExpect(jsonPath("$[0].userId").value("usr-lachlan"))
                .andExpect(jsonPath("$[0].role").value("owner"))
                .andExpect(jsonPath("$[0].profile.email").value("lachlan@example.com"));
        mvc.perform(get("/api/trips/{id}/ideas", TRIP).session(session)).andExpect(jsonPath("$", hasSize(10)));
        mvc.perform(get("/api/trips/{id}/expenses", TRIP).session(session))
                .andExpect(jsonPath("$", hasSize(12)))
                .andExpect(jsonPath("$[?(@.id == 'exp-coffee')].split.kind").value("equal"))
                .andExpect(jsonPath("$[?(@.id == 'exp-kayak-deposit')].split.amounts.usr-ethan").value(4_000))
                .andExpect(jsonPath("$[?(@.id == 'exp-fuel-mel-lorne')].amountCents").value(2_624));
    }

    @Test
    void aThirdVotePromotesTheKayakAndMarksTheVotersAsGoing() throws Exception {
        mvc.perform(json(put("/api/ideas/idea-kayak/vote"), "{\"value\":1}")).andExpect(status().isNoContent());
        mvc.perform(get("/api/trips/{id}/ideas", TRIP).session(session))
                .andExpect(jsonPath("$[?(@.id == 'idea-kayak')].status").value("agreed"))
                .andExpect(jsonPath("$[?(@.id == 'idea-kayak')].attendeeIds[*]",
                        containsInAnyOrder("usr-jonas", "usr-ethan", "usr-lachlan")));

        // Taking the vote back drops it below the line again.
        mvc.perform(delete("/api/ideas/idea-kayak/vote").session(session)).andExpect(status().isNoContent());
        mvc.perform(get("/api/trips/{id}/ideas", TRIP).session(session))
                .andExpect(jsonPath("$[?(@.id == 'idea-kayak')].status").value("voting"));
    }

    @Test
    void plannedActivitiesNeedATimeAndCannotBeVotedOn() throws Exception {
        mvc.perform(json(post("/api/trips/{id}/ideas", TRIP),
                        "{\"title\":\"Pub quiz\",\"description\":\"\",\"category\":\"food\",\"proposedStart\":null,"
                                + "\"proposedEnd\":null,\"allDay\":false,\"needsVote\":false,\"attendeeIds\":[\"usr-mia\"]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Pick a date and time."));
        mvc.perform(json(put("/api/ideas/idea-markets/vote"), "{\"value\":1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("invalid"));
        mvc.perform(json(post("/api/ideas/idea-markets/attending"), "{\"attending\":true}"))
                .andExpect(jsonPath("$.attendeeIds", hasItem("usr-lachlan")));
    }

    @Test
    void aFuelLegWritesThroughToAReadOnlyExpense() throws Exception {
        String leg = mvc.perform(json(post("/api/trips/{id}/fuel", TRIP),
                        "{\"label\":\"Port Campbell to Warrnambool\",\"distanceKm\":66,\"efficiencyL100km\":9.4,"
                                + "\"pricePerLitreCents\":201,\"driverId\":\"usr-priya\",\"riderIds\":[\"usr-priya\",\"usr-mia\"]}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String legId = leg.replaceAll(".*\"id\":\"([^\"]+)\".*", "$1");

        // 66 km at 9.4 L/100km is 6.204 L, at $2.01 is 1247.004 cents.
        mvc.perform(get("/api/trips/{id}/expenses", TRIP).session(session))
                .andExpect(jsonPath("$[?(@.sourceId == '" + legId + "')].amountCents").value(1_247))
                .andExpect(jsonPath("$[?(@.sourceId == '" + legId + "')].paidBy").value("usr-priya"));
        mvc.perform(get("/api/trips/{id}", TRIP).session(session))
                .andExpect(jsonPath("$.defaultPricePerLitreCents").value(201));

        mvc.perform(json(patch("/api/fuel/{id}", legId), "{\"distanceKm\":132}")).andExpect(status().isOk());
        mvc.perform(get("/api/trips/{id}/expenses", TRIP).session(session))
                .andExpect(jsonPath("$[?(@.sourceId == '" + legId + "')].amountCents").value(2_494));

        mvc.perform(json(patch("/api/expenses/exp-fuel-mel-lorne"), "{\"amountCents\":1}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/fuel/{id}", legId).session(session)).andExpect(status().isNoContent());
        mvc.perform(get("/api/trips/{id}/expenses", TRIP).session(session)).andExpect(jsonPath("$", hasSize(12)));
    }

    @Test
    void exactSplitsCannotOweMoreThanTheTotal() throws Exception {
        mvc.perform(json(post("/api/trips/{id}/expenses", TRIP),
                        "{\"description\":\"Ice creams\",\"amountCents\":1000,\"paidBy\":\"usr-lachlan\","
                                + "\"spentAt\":\"2026-10-20T01:00:00.000Z\",\"category\":\"food\","
                                + "\"split\":{\"kind\":\"exact\",\"amounts\":{\"usr-mia\":600,\"usr-jonas\":600}}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("What people owe adds up to more than the total."));
        mvc.perform(json(post("/api/trips/{id}/expenses", TRIP),
                        "{\"description\":\"Ice creams\",\"amountCents\":1000,\"paidBy\":\"usr-lachlan\","
                                + "\"spentAt\":\"2026-10-20T01:00:00.000Z\",\"category\":\"food\","
                                + "\"split\":{\"kind\":\"exact\",\"amounts\":{\"usr-mia\":600,\"usr-lachlan\":400}}}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.split.amounts.usr-mia").value(600))
                .andExpect(jsonPath("$.split.amounts.usr-lachlan").doesNotExist())
                .andExpect(jsonPath("$.spentAt").value("2026-10-20T01:00:00.000Z"));
    }

    @Test
    void openingChatClearsTheUnreadCount() throws Exception {
        mvc.perform(get("/api/channels/chan-general/unread").session(session))
                .andExpect(jsonPath("$.count").value(17))
                .andExpect(jsonPath("$.firstUnreadId").value("msg-02"));
        mvc.perform(post("/api/channels/chan-general/read").session(session)).andExpect(status().isNoContent());
        mvc.perform(get("/api/channels/chan-general/unread").session(session))
                .andExpect(jsonPath("$.count").value(0))
                .andExpect(jsonPath("$.firstUnreadId").value(nullValue()));
        mvc.perform(json(post("/api/channels/chan-general/messages"), "{\"body\":\"  \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aNewAccountJoinsByCodeButCannotSeeTripsBeforehand() throws Exception {
        MockHttpSession newcomer = new MockHttpSession();
        mvc.perform(post("/api/auth/register").session(newcomer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"Sam Lee\",\"email\":\"Sam@Example.com\",\"password\":\"pw\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("sam@example.com"));
        mvc.perform(get("/api/trips/{id}/expenses", TRIP).session(newcomer))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/invites/gor27x"))
                .andExpect(jsonPath("$.trip.id").value(TRIP))
                .andExpect(jsonPath("$.members", hasSize(5)));
        mvc.perform(post("/api/invites/GOR27X/join").session(newcomer)).andExpect(status().isOk());
        mvc.perform(post("/api/invites/GOR27X/join").session(newcomer)).andExpect(status().isOk());
        mvc.perform(get("/api/trips/{id}/members", TRIP).session(session)).andExpect(jsonPath("$", hasSize(6)));

        // The last owner can't leave.
        mvc.perform(delete("/api/trips/{id}/members/usr-lachlan", TRIP).session(session))
                .andExpect(status().isForbidden());
    }

    @Test
    void creatingATripMakesYouItsOwnerWithAGeneralChannel() throws Exception {
        String trip = mvc.perform(json(post("/api/trips"),
                        "{\"name\":\"  Tassie  \",\"destination\":\"Hobart\",\"startDate\":null,\"endDate\":null}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Tassie"))
                .andExpect(jsonPath("$.inviteCode").value(not("GOR27X")))
                .andReturn().getResponse().getContentAsString();
        String tripId = trip.replaceAll(".*\"id\":\"([^\"]+)\".*", "$1");
        mvc.perform(get("/api/trips/{id}/channels", tripId).session(session))
                .andExpect(jsonPath("$[0].name").value("general"));
        mvc.perform(get("/api/trips/{id}/members", tripId).session(session))
                .andExpect(jsonPath("$[0].role").value("owner"));
    }
}
