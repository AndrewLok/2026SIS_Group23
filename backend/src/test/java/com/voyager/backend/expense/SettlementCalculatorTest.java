package com.voyager.backend.expense;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.voyager.backend.expense.SettlementCalculator.Balance;
import com.voyager.backend.expense.SettlementCalculator.Charge;
import com.voyager.backend.expense.SettlementCalculator.Transfer;

/** Ported from the front end's money.test.ts and balances.test.ts. */
class SettlementCalculatorTest {

    private static final List<String> FIVE = List.of("usr-ethan", "usr-jonas", "usr-lachlan", "usr-mia", "usr-priya");

    /** A small trip ledger with uneven totals, a partial split and a payer who isn't sharing. */
    private static final List<Charge> LEDGER = List.of(
            new Charge(78_500, "usr-mia", FIVE),
            new Charge(3_661, "usr-ethan", List.of("usr-priya", "usr-ethan", "usr-lachlan")),
            new Charge(4_260, "usr-lachlan", List.of("usr-ethan", "usr-lachlan", "usr-priya")),
            new Charge(26_240, "usr-jonas", FIVE),
            new Charge(36_613, "usr-priya", FIVE),
            new Charge(1_999, "usr-jonas", List.of("usr-mia", "usr-ethan")));

    private static long sum(Iterable<Long> values) {
        long total = 0;
        for (long v : values) total += v;
        return total;
    }

    private static List<String> ids(int n) {
        return IntStream.range(0, n).mapToObj(i -> "u" + i).toList();
    }

    @Nested
    class Split {

        @Test
        void alwaysSumsBackToTheTotal() {
            for (long total : new long[] {1, 99, 100, 4_250, 26_240, 36_613}) {
                for (int n : new int[] {1, 2, 3, 4, 5, 7}) {
                    Map<String, Long> parts = SettlementCalculator.split(total, ids(n));
                    assertThat(parts).hasSize(n);
                    assertThat(sum(parts.values())).isEqualTo(total);
                }
            }
        }

        @Test
        void givesTheRemainderCentsToTheEarliestParticipants() {
            assertThat(SettlementCalculator.split(100, ids(3)).values()).containsExactly(34L, 33L, 33L);
            assertThat(SettlementCalculator.split(10, ids(4)).values()).containsExactly(3L, 3L, 2L, 2L);
        }

        @Test
        void sortsIdsAsStringsBeforeHandingOutTheRemainder() {
            Map<String, Long> shares = SettlementCalculator.split(3_661, List.of("usr-priya", "usr-ethan", "usr-lachlan"));
            assertThat(shares).containsExactly(
                    Map.entry("usr-ethan", 1_221L),
                    Map.entry("usr-lachlan", 1_220L),
                    Map.entry("usr-priya", 1_220L));
        }

        @Test
        void isTheSameWhateverOrderTheParticipantsArriveIn() {
            assertThat(SettlementCalculator.split(1_001, List.of("c", "a", "b")))
                    .isEqualTo(SettlementCalculator.split(1_001, List.of("b", "c", "a")));
        }

        @Test
        void countsADuplicatedParticipantOnce() {
            assertThat(SettlementCalculator.split(100, List.of("a", "a", "b"))).containsExactly(
                    Map.entry("a", 50L), Map.entry("b", 50L));
        }
    }

    @Nested
    class Balances {

        private final List<Balance> balances = SettlementCalculator.balances(LEDGER);

        @Test
        void netsToZeroAcrossTheGroup() {
            assertThat(balances.stream().mapToLong(Balance::netCents).sum()).isZero();
        }

        @Test
        void accountsForEveryCentSpent() {
            long spent = LEDGER.stream().mapToLong(Charge::amountCents).sum();
            assertThat(balances.stream().mapToLong(Balance::paidCents).sum()).isEqualTo(spent);
            assertThat(balances.stream().mapToLong(Balance::owedCents).sum()).isEqualTo(spent);
        }

        @Test
        void netIsPaidMinusOwed() {
            for (Balance b : balances) assertThat(b.netCents()).isEqualTo(b.paidCents() - b.owedCents());
        }

        @Test
        void handlesAPayerWhoIsNotAParticipant() {
            List<Balance> result = SettlementCalculator.balances(
                    List.of(new Charge(900, "payer", List.of("a", "b", "c"))));
            assertThat(result).containsExactly(
                    new Balance("a", 0, 300, -300),
                    new Balance("b", 0, 300, -300),
                    new Balance("c", 0, 300, -300),
                    new Balance("payer", 900, 0, 900));
        }

        @Test
        void includesMembersWithNoActivityAtZero() {
            List<Balance> result = SettlementCalculator.balances(
                    List.of(new Charge(100, "a", List.of("a", "b"))), List.of("a", "b", "newcomer"));
            assertThat(result).contains(new Balance("newcomer", 0, 0, 0));
        }

        @Test
        void leavesAnUnsharedExpenseWithThePayer() {
            List<Balance> result = SettlementCalculator.balances(List.of(new Charge(500, "a", List.of())));
            assertThat(result).containsExactly(new Balance("a", 500, 500, 0));
        }
    }

    @Nested
    class Settle {

        private final List<Balance> balances = SettlementCalculator.balances(LEDGER);
        private final List<Transfer> transfers = SettlementCalculator.settle(balances);

        @Test
        void clearsEveryPositionExactly() {
            Map<String, Long> after = new HashMap<>();
            for (Balance b : balances) after.put(b.userId(), b.netCents());
            for (Transfer t : transfers) {
                after.merge(t.from(), t.amountCents(), Long::sum);
                after.merge(t.to(), -t.amountCents(), Long::sum);
            }
            assertThat(after.values()).allMatch(net -> net == 0);
        }

        @Test
        void neverProposesAZeroOrSelfTransfer() {
            assertThat(transfers).isNotEmpty();
            for (Transfer t : transfers) {
                assertThat(t.amountCents()).isPositive();
                assertThat(t.from()).isNotEqualTo(t.to());
            }
        }

        @Test
        void usesNoMoreTransfersThanItNeeds() {
            long active = balances.stream().filter(b -> b.netCents() != 0).count();
            assertThat(transfers.size()).isLessThanOrEqualTo((int) Math.max(0, active - 1));
        }

        @Test
        void isDeterministic() {
            List<Balance> shuffled = new ArrayList<>(balances);
            java.util.Collections.reverse(shuffled);
            assertThat(SettlementCalculator.settle(shuffled)).isEqualTo(transfers);
        }

        @Test
        void breaksTiesOnId() {
            List<Balance> tied = List.of(
                    new Balance("b", 500, 0, 500),
                    new Balance("a", 500, 0, 500),
                    new Balance("z", 0, 500, -500),
                    new Balance("y", 0, 500, -500));
            assertThat(SettlementCalculator.settle(tied)).containsExactly(
                    new Transfer("y", "a", 500),
                    new Transfer("z", "b", 500));
        }

        @Test
        void pairsTheLargestDebtorWithTheLargestCreditor() {
            List<Balance> uneven = List.of(
                    new Balance("small", 0, 0, 100),
                    new Balance("big", 0, 0, 900),
                    new Balance("owes", 0, 0, -1_000));
            assertThat(SettlementCalculator.settle(uneven)).containsExactly(
                    new Transfer("owes", "big", 900),
                    new Transfer("owes", "small", 100));
        }

        @Test
        void returnsNothingWhenEveryoneIsSquare() {
            assertThat(SettlementCalculator.settle(List.of(new Balance("a", 100, 100, 0)))).isEmpty();
        }
    }
}
