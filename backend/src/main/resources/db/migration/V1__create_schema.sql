-- The first schema: what the entities in com.voyager.backend describe, as Postgres tables.
-- Ids are UUIDs the application generates. There are no foreign keys on purpose: a person who
-- leaves a trip keeps their expenses, legs and votes for as long as they are owed or owing, and the
-- services, not the database, decide what goes with whom. Hibernate checks this file against the
-- entities at start-up (ddl-auto: validate), so a change to an entity needs a new migration, never an
-- edit to this one.

create table ideas (
    id uuid primary key,
    trip_id uuid not null,
    title varchar(100) not null,
    description varchar(2000) not null,
    category varchar(255) not null,
    proposed_start timestamp with time zone,
    proposed_end timestamp with time zone,
    all_day boolean not null,
    status varchar(255) not null,
    proposed_by uuid not null,
    created_at timestamp with time zone not null
);

create index idx_ideas_trip_id on ideas (trip_id);

create table idea_attendees (
    id uuid primary key,
    idea_id uuid not null,
    user_id uuid not null,
    created_at timestamp with time zone not null,
    unique (idea_id, user_id)
);

create table votes (
    id uuid primary key,
    idea_id uuid not null,
    user_id uuid not null,
    agree boolean not null,
    created_at timestamp with time zone not null,
    unique (idea_id, user_id)
);

create table bookings (
    id uuid primary key,
    trip_id uuid not null,
    type varchar(255) not null,
    title varchar(100) not null,
    provider varchar(100) not null,
    reference varchar(50) not null,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    origin varchar(200) not null,
    destination varchar(200) not null,
    cost_cents bigint,
    belongs_to uuid,
    notes varchar(2000) not null,
    created_by uuid not null,
    created_at timestamp with time zone not null
);

create index idx_bookings_trip_id on bookings (trip_id);

create table calendar_feeds (
    id uuid primary key,
    trip_id uuid not null,
    user_id uuid not null,
    token varchar(64) not null unique,
    created_at timestamp with time zone not null,
    unique (trip_id, user_id)
);

create table chat_channels (
    id uuid primary key,
    trip_id uuid not null,
    name varchar(255) not null,
    unique (trip_id, name)
);

create table chat_messages (
    id uuid primary key,
    channel_id uuid not null,
    author_id uuid not null,
    body varchar(2000) not null,
    created_at timestamp with time zone not null
);

create index idx_chat_messages_channel_created on chat_messages (channel_id, created_at);

create table chat_reads (
    id uuid primary key,
    user_id uuid not null,
    channel_id uuid not null,
    last_read_at timestamp with time zone not null,
    unique (user_id, channel_id)
);

create table expenses (
    id uuid primary key,
    trip_id uuid not null,
    description varchar(100) not null,
    amount_cents bigint not null,
    paid_by uuid not null,
    spent_at timestamp with time zone not null,
    category varchar(255) not null,
    source varchar(255) not null,
    source_id varchar(64),
    split_kind varchar(255),
    created_by uuid not null,
    created_at timestamp with time zone not null
);

create index idx_expenses_trip_id on expenses (trip_id);

create table expense_shares (
    id uuid primary key,
    expense_id uuid not null,
    user_id uuid not null,
    cents bigint,
    unique (expense_id, user_id)
);

create table fuel_legs (
    id uuid primary key,
    trip_id uuid not null,
    label varchar(90) not null,
    distance_km double precision not null,
    efficiency_l100km double precision not null,
    price_per_litre_cents integer not null,
    driver_id uuid not null,
    created_by uuid not null,
    created_at timestamp with time zone not null
);

create index idx_fuel_legs_trip_id on fuel_legs (trip_id);

create table fuel_riders (
    id uuid primary key,
    leg_id uuid not null,
    user_id uuid not null,
    unique (leg_id, user_id)
);

create table trips (
    id uuid primary key,
    name varchar(100) not null,
    destination varchar(100) not null,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    invite_code varchar(6) not null unique,
    created_by uuid not null,
    currency varchar(3) not null,
    cover_hue integer not null,
    budget_cap_cents bigint,
    allowance_cents bigint not null,
    default_efficiency double precision not null,
    default_price_per_litre_cents integer not null,
    private_debts boolean not null
);

create table trip_members (
    id uuid primary key,
    trip_id uuid not null,
    user_id uuid not null,
    role varchar(255) not null,
    joined_at timestamp with time zone not null,
    unique (trip_id, user_id)
);

create table users (
    id uuid primary key,
    display_name varchar(60) not null,
    email varchar(254) not null unique,
    password_hash varchar(255) not null,
    avatar_hue integer not null
);

