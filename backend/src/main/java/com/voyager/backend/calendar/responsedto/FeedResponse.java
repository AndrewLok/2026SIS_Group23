package com.voyager.backend.calendar.responsedto;

import com.voyager.backend.calendar.CalendarFeed;

// Where the signed-in person's subscription link lives, as a path on this server. The frontend puts
// the address it is being served from in front, because only the browser knows the public address.
public record FeedResponse(String path) {

    public static final String PREFIX = "/api/calendar/feeds/";
    public static final String SUFFIX = ".ics";

    public static FeedResponse from(CalendarFeed feed) {
        return new FeedResponse(PREFIX + feed.getToken() + SUFFIX);
    }
}
