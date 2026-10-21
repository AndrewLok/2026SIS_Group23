package com.voyager.backend.expense;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Expense splitting and settlement. Pure maths, no Spring. A port of the front end's
 * lib/balances.ts and splitEvenly from lib/money.ts, so both sides agree to the cent.
 *
 * Ids are compared as strings throughout, which is what keeps the remainder cents and the
 * settlement order the same on every run.
 */
public final class SettlementCalculator {

    private SettlementCalculator() {}

    /**
     * One expense as the maths sees it. Shared evenly across participantIds, unless
     * fixedShares is set, in which case those are the shares as they stand (an exact split).
     */
    public record Charge(long amountCents, String paidBy, Collection<String> participantIds,
                         Map<String, Long> fixedShares) {
        public Charge(long amountCents, String paidBy, Collection<String> participantIds) {
            this(amountCents, paidBy, participantIds, null);
        }
    }

    public record Balance(String userId, long paidCents, long owedCents, long netCents) {}

    public record Transfer(String from, String to, long amountCents) {}

    /**
     * Each participant's share of an expense, in id order. Everyone gets floor(total / n)
     * and the leftover cents go one each to the first participants, so the parts always
     * add back up to the total.
     */
    public static Map<String, Long> split(long amountCents, Collection<String> participantIds) {
        List<String> ids = participantIds.stream().distinct().sorted().toList();
        Map<String, Long> shares = new LinkedHashMap<>();
        if (ids.isEmpty()) return shares;
        long base = Math.floorDiv(amountCents, ids.size());
        long remainder = amountCents - base * ids.size();
        for (int i = 0; i < ids.size(); i++) {
            shares.put(ids.get(i), base + (i < remainder ? 1 : 0));
        }
        return shares;
    }

    public static List<Balance> balances(Collection<Charge> charges) {
        return balances(charges, List.of());
    }

    /**
     * Paid, owed and net for every payer and participant, plus anyone in alwaysInclude (so
     * a member with no activity still shows up at zero). Sorted by user id.
     */
    public static List<Balance> balances(Collection<Charge> charges, Collection<String> alwaysInclude) {
        Map<String, long[]> totals = new TreeMap<>(); // userId -> {paid, owed}
        for (String id : alwaysInclude) totals.computeIfAbsent(id, k -> new long[2]);

        for (Charge charge : charges) {
            totals.computeIfAbsent(charge.paidBy(), k -> new long[2])[0] += charge.amountCents();
            Map<String, Long> shares = charge.fixedShares() != null
                    ? charge.fixedShares()
                    : split(charge.amountCents(), charge.participantIds());
            // Nobody to share it with: the payer carries it, so the ledger still nets to zero.
            if (shares.isEmpty()) shares = Map.of(charge.paidBy(), charge.amountCents());
            shares.forEach((userId, share) -> totals.computeIfAbsent(userId, k -> new long[2])[1] += share);
        }

        List<Balance> result = new ArrayList<>(totals.size());
        totals.forEach((userId, t) -> result.add(new Balance(userId, t[0], t[1], t[0] - t[1])));
        return result;
    }

    /**
     * Reduces balances to a short list of transfers. Greedy: the largest debtor pays the
     * largest creditor as much as the smaller of the two allows, then the pass repeats.
     * Ties break on user id, so the same balances always give the same list.
     */
    public static List<Transfer> settle(Collection<Balance> balances) {
        Comparator<Position> byMagnitude = Comparator.comparingLong((Position p) -> p.amount).reversed()
                .thenComparing(p -> p.id);

        List<Position> creditors = balances.stream()
                .filter(b -> b.netCents() > 0)
                .map(b -> new Position(b.userId(), b.netCents()))
                .sorted(byMagnitude)
                .toList();
        List<Position> debtors = balances.stream()
                .filter(b -> b.netCents() < 0)
                .map(b -> new Position(b.userId(), -b.netCents()))
                .sorted(byMagnitude)
                .toList();

        List<Transfer> transfers = new ArrayList<>();
        int c = 0;
        int d = 0;
        while (c < creditors.size() && d < debtors.size()) {
            Position creditor = creditors.get(c);
            Position debtor = debtors.get(d);
            long amount = Math.min(creditor.amount, debtor.amount);
            if (amount > 0) {
                transfers.add(new Transfer(debtor.id, creditor.id, amount));
                creditor.amount -= amount;
                debtor.amount -= amount;
            }
            if (creditor.amount == 0) c++;
            if (debtor.amount == 0) d++;
        }
        return transfers;
    }

    private static final class Position {
        final String id;
        long amount;

        Position(String id, long amount) {
            this.id = id;
            this.amount = amount;
        }
    }
}
