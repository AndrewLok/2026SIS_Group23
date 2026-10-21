package com.voyager.backend.expense;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.voyager.backend.common.ApiException;

/**
 * How a manual expense is shared, as the front end's ExpenseSplit:
 * { kind: "equal", userIds: [...] } or { kind: "exact", amounts: { userId: cents } }.
 */
public record ExpenseSplit(String kind, List<String> userIds, Map<String, Long> amounts) {

    private static final String UNREADABLE = "That split couldn't be read.";

    public static ExpenseSplit equal(List<String> userIds) {
        return new ExpenseSplit(Expense.SPLIT_EQUAL, List.copyOf(userIds), null);
    }

    public static ExpenseSplit exact(Map<String, Long> amounts) {
        return new ExpenseSplit(Expense.SPLIT_EXACT, null, new LinkedHashMap<>(amounts));
    }

    public boolean isEqual() {
        return Expense.SPLIT_EQUAL.equals(kind);
    }

    /** Every member the split names. */
    public List<String> memberIds() {
        return isEqual() ? userIds : new ArrayList<>(amounts.keySet());
    }

    /** The JSON shape the front end reads. */
    public Map<String, Object> toWire() {
        Map<String, Object> wire = new LinkedHashMap<>();
        wire.put("kind", kind);
        if (isEqual()) wire.put("userIds", userIds);
        else wire.put("amounts", amounts);
        return wire;
    }

    /**
     * Reads the JSON the front end sends. Only checks the shape; whether the people and
     * amounts make sense is ExpenseService's job. Returns null for null.
     */
    public static ExpenseSplit fromWire(Object raw) {
        if (raw == null) return null;
        if (!(raw instanceof Map<?, ?> map)) throw ApiException.invalid(UNREADABLE);
        Object kind = map.get("kind");
        if (Expense.SPLIT_EQUAL.equals(kind)) {
            if (!(map.get("userIds") instanceof List<?> list)) throw ApiException.invalid(UNREADABLE);
            List<String> ids = new ArrayList<>();
            for (Object id : list) {
                if (!(id instanceof String s)) throw ApiException.invalid(UNREADABLE);
                ids.add(s);
            }
            return equal(ids);
        }
        if (Expense.SPLIT_EXACT.equals(kind)) {
            if (!(map.get("amounts") instanceof Map<?, ?> amounts)) throw ApiException.invalid(UNREADABLE);
            Map<String, Long> parsed = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : amounts.entrySet()) {
                if (!(entry.getKey() instanceof String id) || !(entry.getValue() instanceof Number n)
                        || n.doubleValue() != Math.rint(n.doubleValue()) || n.longValue() < 0) {
                    throw ApiException.invalid("Amounts owed must be zero or more.");
                }
                parsed.put(id, n.longValue());
            }
            return exact(parsed);
        }
        throw ApiException.invalid(UNREADABLE);
    }
}
