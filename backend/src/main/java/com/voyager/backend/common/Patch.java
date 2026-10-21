package com.voyager.backend.common;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * A partial update as the front end sends it: a key that is absent means "leave it", a key
 * that is present with null means "clear it". A record can't tell those two apart, so
 * update endpoints take the raw JSON object and read it through this.
 */
public final class Patch {

    private static final String UNREADABLE = "That request couldn't be read.";

    private final Map<String, Object> fields;

    public Patch(Map<String, Object> fields) {
        this.fields = fields == null ? Map.of() : fields;
    }

    public boolean has(String key) {
        return fields.containsKey(key);
    }

    public Object raw(String key) {
        return fields.get(key);
    }

    public String string(String key) {
        Object value = fields.get(key);
        if (value == null) return null;
        if (value instanceof String s) return s;
        throw ApiException.invalid(UNREADABLE);
    }

    public Long longValue(String key) {
        Object value = fields.get(key);
        if (value == null) return null;
        if (value instanceof Number n && n.doubleValue() == Math.rint(n.doubleValue())) return n.longValue();
        throw ApiException.invalid(UNREADABLE);
    }

    public Double doubleValue(String key) {
        Object value = fields.get(key);
        if (value == null) return null;
        if (value instanceof Number n) return n.doubleValue();
        throw ApiException.invalid(UNREADABLE);
    }

    public Boolean bool(String key) {
        Object value = fields.get(key);
        if (value == null) return null;
        if (value instanceof Boolean b) return b;
        throw ApiException.invalid(UNREADABLE);
    }

    public List<String> strings(String key) {
        Object value = fields.get(key);
        if (value == null) return null;
        if (!(value instanceof List<?> list)) throw ApiException.invalid(UNREADABLE);
        List<String> result = new ArrayList<>(list.size());
        for (Object item : list) {
            if (!(item instanceof String s)) throw ApiException.invalid(UNREADABLE);
            result.add(s);
        }
        return result;
    }
}
