package com.voyager.backend.demo;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.voyager.backend.booking.Booking;
import com.voyager.backend.booking.BookingRepository;
import com.voyager.backend.chat.Channel;
import com.voyager.backend.chat.ChannelReadRepository;
import com.voyager.backend.chat.ChannelRepository;
import com.voyager.backend.chat.Message;
import com.voyager.backend.chat.MessageRepository;
import com.voyager.backend.expense.Expense;
import com.voyager.backend.expense.ExpenseCategory;
import com.voyager.backend.expense.ExpenseRepository;
import com.voyager.backend.expense.ExpenseSplit;
import com.voyager.backend.fuel.FuelLeg;
import com.voyager.backend.fuel.FuelLegRepository;
import com.voyager.backend.idea.Idea;
import com.voyager.backend.idea.IdeaRepository;
import com.voyager.backend.idea.Vote;
import com.voyager.backend.idea.VoteRepository;
import com.voyager.backend.trip.Trip;
import com.voyager.backend.trip.TripMember;
import com.voyager.backend.trip.TripMemberRepository;
import com.voyager.backend.trip.TripRepository;
import com.voyager.backend.user.User;
import com.voyager.backend.user.UserRepository;

/**
 * The demo trip, a port of the front end's services/mock/seed.ts so the app looks the same
 * with or without the backend. It is fiction: no person, booking, reference or figure here
 * corresponds to anything real.
 *
 * Ids are readable and fixed rather than random. Split remainders are allocated in id order,
 * so stable ids keep every balance reproducible and hand-checkable.
 */
@Component
public class DemoData {

    /** The account the "try the demo trip" button signs in as. */
    public static final String DEMO_EMAIL = "lachlan@example.com";
    public static final String DEMO_PASSWORD = "roadtrip";

    private static final String ETHAN = "usr-ethan";
    private static final String JONAS = "usr-jonas";
    private static final String LACHLAN = "usr-lachlan";
    private static final String MIA = "usr-mia";
    private static final String PRIYA = "usr-priya";
    private static final List<String> EVERYONE = List.of(LACHLAN, PRIYA, ETHAN, MIA, JONAS);

    private static final String TRIP = "trip-gor";
    private static final String CHANNEL = "chan-general";

    /** Trip starts far enough out that the countdown is the interesting number. */
    private static final int TRIP_START = 18;
    private static final int TRIP_LENGTH = 7;

    private final UserRepository users;
    private final TripRepository trips;
    private final TripMemberRepository members;
    private final IdeaRepository ideas;
    private final VoteRepository votes;
    private final BookingRepository bookings;
    private final FuelLegRepository fuelLegs;
    private final ExpenseRepository expenses;
    private final ChannelRepository channels;
    private final MessageRepository messages;
    private final ChannelReadRepository channelReads;
    private final BCryptPasswordEncoder passwordEncoder;

    public DemoData(UserRepository users, TripRepository trips, TripMemberRepository members, IdeaRepository ideas,
                    VoteRepository votes, BookingRepository bookings, FuelLegRepository fuelLegs,
                    ExpenseRepository expenses, ChannelRepository channels, MessageRepository messages,
                    ChannelReadRepository channelReads, BCryptPasswordEncoder passwordEncoder) {
        this.users = users;
        this.trips = trips;
        this.members = members;
        this.ideas = ideas;
        this.votes = votes;
        this.bookings = bookings;
        this.fuelLegs = fuelLegs;
        this.expenses = expenses;
        this.channels = channels;
        this.messages = messages;
        this.channelReads = channelReads;
        this.passwordEncoder = passwordEncoder;
    }

    /** Throw away everything and reseed. Used by the "reset demo data" action. */
    @Transactional
    public void reset() {
        channelReads.deleteAll();
        messages.deleteAll();
        channels.deleteAll();
        expenses.deleteAll();
        fuelLegs.deleteAll();
        bookings.deleteAll();
        votes.deleteAll();
        ideas.deleteAll();
        members.deleteAll();
        trips.deleteAll();
        users.deleteAll();
        users.flush();
        seed();
    }

    /** An instant n days from now, at the given local time. */
    private static Instant at(int dayOffset, int hour, int minute) {
        return ZonedDateTime.now(ZoneId.systemDefault()).plusDays(dayOffset)
                .withHour(hour).withMinute(minute).withSecond(0).withNano(0).toInstant();
    }

    private static Instant at(int dayOffset) {
        return at(dayOffset, 9, 0);
    }

    @Transactional
    public void seed() {
        String hash = passwordEncoder.encode(DEMO_PASSWORD);
        users.saveAll(List.of(
                new User(LACHLAN, "Lachlan Fawle", DEMO_EMAIL, hash, 142),
                new User(PRIYA, "Priya Raman", "priya@example.com", hash, 28),
                new User(ETHAN, "Ethan Brand", "ethan@example.com", hash, 205),
                new User(MIA, "Mia Okafor", "mia@example.com", hash, 315),
                new User(JONAS, "Jonas Vidal", "jonas@example.com", hash, 55)));

        int startYear = ZonedDateTime.now(ZoneId.systemDefault()).plusDays(TRIP_START).getYear();
        trips.save(new Trip(TRIP, "Great Ocean Road " + startYear, "Victoria, Australia",
                at(TRIP_START, 7, 0), at(TRIP_START + TRIP_LENGTH, 18, 0), "GOR27X", LACHLAN, 142));

        members.saveAll(List.of(
                new TripMember(TRIP, LACHLAN, TripMember.OWNER, at(-40)),
                new TripMember(TRIP, PRIYA, TripMember.MEMBER, at(-39)),
                new TripMember(TRIP, ETHAN, TripMember.MEMBER, at(-38)),
                new TripMember(TRIP, MIA, TripMember.MEMBER, at(-36)),
                new TripMember(TRIP, JONAS, TripMember.MEMBER, at(-31))));

        seedIdeas();
        seedBookings();
        seedMoney();
        seedChat();
    }

    private void seedIdeas() {
        ideas.saveAll(List.of(
                new Idea("idea-apostles", TRIP, "Twelve Apostles at sunrise",
                        "Leave Apollo Bay at 05:30 to get there before the tour buses.", "activity",
                        at(TRIP_START + 2, 6, 15), at(TRIP_START + 2, 8, 30), false, Idea.AGREED, PRIYA,
                        List.of(PRIYA, LACHLAN, ETHAN, MIA, JONAS), at(-30)),
                new Idea("idea-otway", TRIP, "Otway rainforest walk",
                        "Maits Rest, about an hour on the boardwalk. Easy on tired legs.", "activity",
                        at(TRIP_START + 3, 10, 0), at(TRIP_START + 3, 12, 0), false, Idea.AGREED, ETHAN,
                        List.of(ETHAN, LACHLAN, MIA, PRIYA), at(-28)),
                new Idea("idea-fishnchips", TRIP, "Fish and chips on the Apollo Bay foreshore",
                        "Cheap night. Everyone gets their own, no splitting a share plate.", "food",
                        at(TRIP_START + 2, 18, 30), at(TRIP_START + 2, 20, 0), false, Idea.AGREED, MIA,
                        List.of(MIA, JONAS, ETHAN, LACHLAN), at(-25)),
                new Idea("idea-lorne-house", TRIP, "Split a house in Lorne for two nights",
                        "Cheaper per head than two motel rooms once there are five of us.", "stay",
                        null, null, false, Idea.AGREED, LACHLAN, List.of(LACHLAN, PRIYA, MIA), at(-24)),
                // Added straight to the plan, no vote. The demo user is not in yet.
                new Idea("idea-markets", TRIP, "Apollo Bay Saturday market",
                        "Breakfast from the stalls, then a wander. Back by eleven.", "food",
                        at(TRIP_START + 3, 8, 30), null, false, Idea.PLANNED, MIA, List.of(MIA, PRIYA), at(-3)),
                new Idea("idea-kayak", TRIP, "Kayak out to the seal colony",
                        "Two hours from Marengo. Needs at least four people to book.", "activity",
                        at(TRIP_START + 4, 9, 0), at(TRIP_START + 4, 11, 0), false, Idea.VOTING, JONAS,
                        List.of(), at(-12)),
                // Same morning as the kayak, so the vote shows two options side by side.
                new Idea("idea-lighthouse", TRIP, "Cape Otway lightstation",
                        "Climb the lighthouse and look for whales. Café on site for the non-climbers.", "activity",
                        at(TRIP_START + 4, 9, 30), at(TRIP_START + 4, 12, 0), false, Idea.VOTING, PRIYA,
                        List.of(), at(-5)),
                new Idea("idea-winery", TRIP, "Long lunch at a Bellarine winery",
                        "Would need a nominated driver, which nobody has volunteered for.", "food",
                        at(TRIP_START + 5, 12, 30), at(TRIP_START + 5, 15, 30), false, Idea.VOTING, PRIYA,
                        List.of(), at(-9)),
                new Idea("idea-surf", TRIP, "Beginner surf lesson at Torquay",
                        "Boards and wetsuits included. Mia and Jonas have never surfed.", "activity",
                        null, null, false, Idea.VOTING, MIA, List.of(), at(-6)),
                new Idea("idea-skydive", TRIP, "Skydive over Barwon Heads",
                        "Four hundred each and half the group said absolutely not.", "activity",
                        null, null, false, Idea.REJECTED, JONAS, List.of(), at(-20))));

        votes.saveAll(List.of(
                // Apostles: agreed, 5 of 5.
                new Vote("idea-apostles", PRIYA, 1, at(-30)),
                new Vote("idea-apostles", LACHLAN, 1, at(-30)),
                new Vote("idea-apostles", ETHAN, 1, at(-29)),
                new Vote("idea-apostles", MIA, 1, at(-29)),
                new Vote("idea-apostles", JONAS, 1, at(-28)),
                // Otway: agreed, 4 for, 1 against.
                new Vote("idea-otway", ETHAN, 1, at(-28)),
                new Vote("idea-otway", LACHLAN, 1, at(-27)),
                new Vote("idea-otway", MIA, 1, at(-27)),
                new Vote("idea-otway", PRIYA, 1, at(-26)),
                new Vote("idea-otway", JONAS, -1, at(-26)),
                // Fish and chips: agreed, 4 for.
                new Vote("idea-fishnchips", MIA, 1, at(-25)),
                new Vote("idea-fishnchips", JONAS, 1, at(-24)),
                new Vote("idea-fishnchips", ETHAN, 1, at(-24)),
                new Vote("idea-fishnchips", LACHLAN, 1, at(-23)),
                // Lorne house: agreed, 3 for, but still has no dates.
                new Vote("idea-lorne-house", LACHLAN, 1, at(-24)),
                new Vote("idea-lorne-house", PRIYA, 1, at(-23)),
                new Vote("idea-lorne-house", MIA, 1, at(-22)),
                // Kayak: 2 for, one short of the line.
                new Vote("idea-kayak", JONAS, 1, at(-12)),
                new Vote("idea-kayak", ETHAN, 1, at(-11)),
                // Winery: split.
                new Vote("idea-winery", PRIYA, 1, at(-9)),
                new Vote("idea-winery", MIA, 1, at(-8)),
                new Vote("idea-winery", ETHAN, -1, at(-8)),
                new Vote("idea-winery", JONAS, -1, at(-7)),
                // Surf: one vote so far.
                new Vote("idea-surf", MIA, 1, at(-6)),
                // Lightstation: Priya and Mia would rather do this than kayak.
                new Vote("idea-lighthouse", PRIYA, 1, at(-5)),
                new Vote("idea-lighthouse", MIA, 1, at(-4)),
                // Skydive: rejected outright.
                new Vote("idea-skydive", JONAS, 1, at(-20)),
                new Vote("idea-skydive", PRIYA, -1, at(-19)),
                new Vote("idea-skydive", MIA, -1, at(-19)),
                new Vote("idea-skydive", LACHLAN, -1, at(-18))));
    }

    private void seedBookings() {
        bookings.saveAll(List.of(
                new Booking("bk-house-lorne", TRIP, "stay", "Beach house, Lorne", "Great Ocean Stays", "GOS-44192",
                        at(TRIP_START, 15, 0), at(TRIP_START + 2, 10, 0), "", "18 Mountjoy Parade, Lorne",
                        96_000L, null,
                        "Three bedrooms, sofa bed in the lounge. Key in the lockbox, code sent the day before."),
                new Booking("bk-apollo-motel", TRIP, "stay", "Apollo Bay motel, two rooms", "Bayside Motor Inn",
                        "BMI-77310", at(TRIP_START + 2, 14, 0), at(TRIP_START + 4, 10, 0), "", "Apollo Bay",
                        64_000L, null, ""),
                new Booking("bk-jonas-flight", TRIP, "flight", "JQ 610 BNE to MEL", "Jetstar", "K4RT2W",
                        at(TRIP_START - 1, 6, 20), at(TRIP_START - 1, 9, 5), "BNE", "MEL", 21_900L, JONAS,
                        "Jonas is flying down the night before and staying with his cousin."),
                new Booking("bk-van", TRIP, "car", "8-seat van, 8 days", "Melbourne Van Hire", "MVH-2208841",
                        at(TRIP_START, 8, 0), at(TRIP_START + TRIP_LENGTH, 17, 0), "Melbourne Airport",
                        "Melbourne Airport", 78_500L, null,
                        "Lachlan and Priya are both on the licence. Excess reduction included.")));
    }

    private void seedMoney() {
        FuelLeg melLorne = new FuelLeg("fuel-mel-lorne", TRIP, "Melbourne to Lorne", 141, 9.4, 198, LACHLAN,
                EVERYONE, at(-5));
        FuelLeg lorneApollo = new FuelLeg("fuel-lorne-apollo", TRIP, "Lorne to Apollo Bay", 45, 9.4, 212, PRIYA,
                EVERYONE, at(-4));
        // Mia and Jonas stayed behind, so this one splits three ways.
        FuelLeg apolloPc = new FuelLeg("fuel-apollo-portcampbell", TRIP, "Apollo Bay to Port Campbell and back",
                190, 9.4, 205, ETHAN, List.of(LACHLAN, ETHAN, PRIYA), at(-3));
        fuelLegs.saveAll(List.of(melLorne, lorneApollo, apolloPc));

        Expense kayak = manual("exp-kayak-deposit", "Kayak tour deposit, refundable", 8_000, JONAS,
                at(-10, 20, 0), ExpenseCategory.TICKETS);
        // Two places held. Ethan owes Jonas for his; the other is Jonas's own.
        kayak.setSplit(ExpenseSplit.exact(Map.of(ETHAN, 4_000L)));
        Expense coffee = manual("exp-coffee", "Coffees and pies at the servo", 4_260, PRIYA,
                at(-1, 8, 40), ExpenseCategory.FOOD);
        // Only the three in the car that morning.
        coffee.setSplit(ExpenseSplit.equal(List.of(PRIYA, LACHLAN, ETHAN)));

        expenses.saveAll(List.of(
                manual("exp-house-deposit", "Lorne house deposit", 48_000, PRIYA, at(-26, 19, 0), ExpenseCategory.STAY),
                manual("exp-house-balance", "Lorne house balance", 48_000, PRIYA, at(-6, 9, 30), ExpenseCategory.STAY),
                manual("exp-motel", "Apollo Bay motel, both rooms", 64_000, MIA, at(-21, 11, 0), ExpenseCategory.STAY),
                manual("exp-van", "Van hire, paid up front", 78_500, LACHLAN, at(-19, 16, 45), ExpenseCategory.TRANSPORT),
                manual("exp-esky", "Esky, camp chairs and a gas bottle", 13_450, ETHAN, at(-11, 14, 20),
                        ExpenseCategory.OTHER),
                manual("exp-groceries-1", "First big grocery shop", 21_780, MIA, at(-2, 17, 10), ExpenseCategory.FOOD),
                kayak,
                manual("exp-parkpass", "Otway parks day passes", 6_500, ETHAN, at(-7, 12, 0), ExpenseCategory.TICKETS),
                coffee,
                // Written through from the legs above, so they split across riders only.
                fuel("exp-fuel-mel-lorne", melLorne, at(-5, 10, 0)),
                fuel("exp-fuel-lorne-apollo", lorneApollo, at(-4, 15, 30)),
                fuel("exp-fuel-apollo-pc", apolloPc, at(-3, 18, 15))));
    }

    private static Expense manual(String id, String description, long cents, String paidBy, Instant spentAt,
                                  ExpenseCategory category) {
        return new Expense(id, TRIP, description, cents, paidBy, spentAt, category, Expense.MANUAL, null);
    }

    private static Expense fuel(String id, FuelLeg leg, Instant spentAt) {
        return new Expense(id, TRIP, "Fuel: " + leg.getLabel(), leg.costCents(), leg.getDriverId(), spentAt,
                ExpenseCategory.TRANSPORT, Expense.FUEL, leg.getId());
    }

    private void seedChat() {
        channels.save(new Channel(CHANNEL, TRIP, "general"));
        Object[][] lines = {
                {LACHLAN, "Right, van is booked. Eight seats so nobody has to sit on the esky.", -19, 16, 50},
                {PRIYA, "Legend. I put the house deposit down too.", -19, 17, 2},
                {PRIYA, "Can everyone check the dates on the booking before I pay the rest", -19, 17, 3},
                {ETHAN, "Dates look right to me", -19, 18, 22},
                {MIA, "Same. Motel in Apollo Bay is sorted for the two nights after.", -18, 9, 15},
                {JONAS, "I am flying in the night before, will meet you at the airport in the morning", -18, 20, 40},
                {JONAS, "Also I still think the skydive was a good idea", -18, 20, 41},
                {MIA, "It was four hundred dollars Jonas", -18, 20, 44},
                {ETHAN, "Outvoted mate", -18, 21, 1},
                {LACHLAN, "Sunrise at the Apostles is locked in. We leave Apollo Bay at half five.", -12, 8, 30},
                {MIA, "Half five in the morning?", -12, 8, 33},
                {PRIYA, "That is the whole point of going at sunrise", -12, 8, 35},
                {MIA, "Fine. Someone else is driving though.", -12, 8, 36},
                {ETHAN, "Got the park passes and a few camp chairs. Put them both in the app.", -7, 12, 10},
                {JONAS, "Kayak place wants four minimum, we have two votes so far", -6, 19, 20},
                {LACHLAN, "Have a look at the voting tab everyone, a few things still need calling", -5, 9, 5},
                {PRIYA, "Paid the house balance this morning so that is fully settled now", -5, 9, 40},
                {MIA, "Did the big shop. Receipt is in the expenses.", -2, 17, 15},
                {ETHAN, "Anyone want anything from Torquay on the way through", -1, 7, 50},
                {JONAS, "Coffee. Large.", -1, 7, 55},
        };
        for (int i = 0; i < lines.length; i++) {
            Object[] line = lines[i];
            messages.save(new Message(String.format("msg-%02d", i + 1), CHANNEL, (String) line[0], (String) line[1],
                    at((int) line[2], (int) line[3], (int) line[4])));
        }
    }
}
