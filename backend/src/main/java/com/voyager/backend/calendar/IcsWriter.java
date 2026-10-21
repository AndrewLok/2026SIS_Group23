package com.voyager.backend.calendar;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

// Writes an iCalendar (.ics, RFC 5545) file. Pure text in, text out, so it can be checked without a
// server. The three things that go wrong in hand-written .ics files are all handled here: text is
// escaped (a comma or newline in a title must not break the line), lines are folded at 75 bytes
// without splitting a multi-byte character, and every line ends in CRLF.
//
// Times are written in UTC ("...Z"), which every calendar app converts into the viewer's own zone,
// because that is what an activity's start is: an instant. An all-day activity is written as a plain
// date instead, taken from the UTC date of its start.

public final class IcsWriter {

    private IcsWriter() {}

    // One entry on the calendar. end may be null (a point in time); uid must stay the same for the
    // life of the entry, so a calendar app updates it instead of adding a second copy.
    public record Event(String uid, Instant stamp, Instant start, Instant end, boolean allDay,
            String summary, String description, String category) {}

    private static final String CRLF = "\r\n";
    private static final int MAX_LINE_BYTES = 75;
    private static final DateTimeFormatter DATE_TIME =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);

    public static String calendar(String name, List<Event> events) {
        StringBuilder out = new StringBuilder();
        line(out, "BEGIN:VCALENDAR");
        line(out, "VERSION:2.0");
        line(out, "PRODID:-//Voyager//Trip calendar//EN");
        line(out, "CALSCALE:GREGORIAN");
        line(out, "X-WR-CALNAME:" + escape(name));
        // Hints for how often to look again. Apps are free to ignore them, and several do.
        line(out, "REFRESH-INTERVAL;VALUE=DURATION:PT1H");
        line(out, "X-PUBLISHED-TTL:PT1H");
        for (Event event : events) {
            write(out, event);
        }
        line(out, "END:VCALENDAR");
        return out.toString();
    }

    private static void write(StringBuilder out, Event e) {
        line(out, "BEGIN:VEVENT");
        line(out, "UID:" + e.uid());
        line(out, "DTSTAMP:" + DATE_TIME.format(e.stamp()));
        if (e.allDay()) {
            LocalDate first = e.start().atZone(ZoneOffset.UTC).toLocalDate();
            LocalDate last = e.end() == null ? first : e.end().atZone(ZoneOffset.UTC).toLocalDate();
            if (last.isBefore(first)) {
                last = first;
            }
            // DTEND on a date is the day after the last day.
            line(out, "DTSTART;VALUE=DATE:" + DATE.format(first));
            line(out, "DTEND;VALUE=DATE:" + DATE.format(last.plusDays(1)));
        } else {
            line(out, "DTSTART:" + DATE_TIME.format(e.start()));
            if (e.end() != null && e.end().isAfter(e.start())) {
                line(out, "DTEND:" + DATE_TIME.format(e.end()));
            }
        }
        line(out, "SUMMARY:" + escape(e.summary()));
        if (e.description() != null && !e.description().isBlank()) {
            line(out, "DESCRIPTION:" + escape(e.description()));
        }
        if (e.category() != null && !e.category().isBlank()) {
            line(out, "CATEGORIES:" + escape(e.category()));
        }
        line(out, "END:VEVENT");
    }

    // Backslash, semicolon and comma are escaped, a newline becomes the two characters \n, and other
    // control characters are dropped, because none of them can appear in a text value.
    static String escape(String text) {
        StringBuilder out = new StringBuilder(text.length() + 8);
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            switch (c) {
                case '\\' -> out.append("\\\\");
                case ';' -> out.append("\\;");
                case ',' -> out.append("\\,");
                case '\n' -> out.append("\\n");
                case '\r' -> {
                    // A CRLF pair is one line break.
                    if (i + 1 < text.length() && text.charAt(i + 1) == '\n') {
                        i++;
                    }
                    out.append("\\n");
                }
                default -> {
                    if (c >= 0x20 && c != 0x7f) {
                        out.append(c);
                    }
                }
            }
        }
        return out.toString();
    }

    // Adds one logical line, folded: no physical line is longer than 75 bytes (the CRLF not counted),
    // and each continuation starts with a single space, which a reader removes again.
    static void line(StringBuilder out, String text) {
        int used = 0;
        int limit = MAX_LINE_BYTES;
        for (int i = 0; i < text.length(); ) {
            int cp = text.codePointAt(i);
            int size = new String(Character.toChars(cp)).getBytes(StandardCharsets.UTF_8).length;
            if (used + size > limit) {
                out.append(CRLF).append(' ');
                used = 0;
                limit = MAX_LINE_BYTES - 1; // The leading space is part of the 75.
            }
            out.appendCodePoint(cp);
            used += size;
            i += Character.charCount(cp);
        }
        out.append(CRLF);
    }
}
