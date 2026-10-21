
    create schema voyager;

    create table voyager.bookings (
        cost_cents bigint,
        ends_at timestamp(6) with time zone,
        starts_at timestamp(6) with time zone,
        notes varchar(2000) not null,
        belongs_to varchar(255),
        destination varchar(255) not null,
        id varchar(255) not null,
        origin varchar(255) not null,
        provider varchar(255) not null,
        reference varchar(255) not null,
        title varchar(255) not null,
        trip_id varchar(255) not null,
        type varchar(255) not null,
        primary key (id)
    );

    create table voyager.channel_reads (
        last_read_at timestamp(6) with time zone not null,
        id varchar(255) not null,
        primary key (id)
    );

    create table voyager.channels (
        id varchar(255) not null,
        name varchar(255) not null,
        trip_id varchar(255) not null,
        primary key (id)
    );

    create table voyager.expense_split_amounts (
        amount_cents bigint not null,
        expense_id varchar(255) not null,
        user_id varchar(255) not null,
        primary key (expense_id, user_id)
    );

    create table voyager.expense_split_users (
        position integer not null check ((position>=0)),
        expense_id varchar(255) not null,
        user_id varchar(255) not null,
        primary key (position, expense_id)
    );

    create table voyager.expenses (
        amount_cents bigint not null,
        created_at timestamp(6) with time zone,
        spent_at timestamp(6) with time zone not null,
        description varchar(500) not null,
        category varchar(255) not null check ((category in ('FOOD','TRANSPORT','TICKETS','STAY','OTHER'))),
        id varchar(255) not null,
        paid_by varchar(255) not null,
        source varchar(255) not null,
        source_id varchar(255),
        split_kind varchar(255),
        trip_id varchar(255) not null,
        primary key (id)
    );

    create table voyager.fuel_leg_riders (
        position integer not null check ((position>=0)),
        fuel_leg_id varchar(255) not null,
        user_id varchar(255) not null,
        primary key (position, fuel_leg_id)
    );

    create table voyager.fuel_legs (
        distance_km float(53) not null,
        efficiency_l100km float(53) not null,
        created_at timestamp(6) with time zone not null,
        price_per_litre_cents bigint not null,
        driver_id varchar(255) not null,
        id varchar(255) not null,
        label varchar(255) not null,
        trip_id varchar(255) not null,
        primary key (id)
    );

    create table voyager.idea_attendees (
        position integer not null check ((position>=0)),
        idea_id varchar(255) not null,
        user_id varchar(255) not null,
        primary key (position, idea_id)
    );

    create table voyager.ideas (
        all_day boolean not null,
        created_at timestamp(6) with time zone not null,
        proposed_end timestamp(6) with time zone,
        proposed_start timestamp(6) with time zone,
        description varchar(2000) not null,
        category varchar(255) not null,
        id varchar(255) not null,
        proposed_by varchar(255) not null,
        status varchar(255) not null,
        title varchar(255) not null,
        trip_id varchar(255) not null,
        primary key (id)
    );

    create table voyager.messages (
        created_at timestamp(6) with time zone not null,
        body varchar(4000) not null,
        author_id varchar(255) not null,
        channel_id varchar(255) not null,
        id varchar(255) not null,
        primary key (id)
    );

    create table voyager.trip_members (
        joined_at timestamp(6) with time zone not null,
        id varchar(255) not null,
        role varchar(255) not null,
        trip_id varchar(255) not null,
        user_id varchar(255) not null,
        primary key (id),
        unique (trip_id, user_id)
    );

    create table voyager.trips (
        cover_hue integer not null,
        currency varchar(3) not null,
        default_efficiency float(53) not null,
        private_debts boolean not null,
        invite_code varchar(6) not null unique,
        allowance_cents bigint not null,
        default_price_per_litre_cents bigint not null,
        end_date timestamp(6) with time zone,
        start_date timestamp(6) with time zone,
        created_by varchar(255) not null,
        destination varchar(255) not null,
        id varchar(255) not null,
        name varchar(255) not null,
        primary key (id)
    );

    create table voyager.users (
        avatar_hue integer not null,
        display_name varchar(255) not null,
        email varchar(255) not null unique,
        id varchar(255) not null,
        password_hash varchar(255) not null,
        primary key (id)
    );

    create table voyager.votes (
        vote_value integer not null,
        created_at timestamp(6) with time zone not null,
        id varchar(255) not null,
        idea_id varchar(255) not null,
        user_id varchar(255) not null,
        primary key (id),
        unique (idea_id, user_id)
    );

    create index idx_bookings_trip_id 
       on voyager.bookings (trip_id);

    create index idx_channels_trip_id 
       on voyager.channels (trip_id);

    create index idx_expenses_trip_id 
       on voyager.expenses (trip_id);

    create index idx_fuel_legs_trip_id 
       on voyager.fuel_legs (trip_id);

    create index idx_ideas_trip_id 
       on voyager.ideas (trip_id);

    create index idx_messages_channel_id 
       on voyager.messages (channel_id);

    create index idx_trip_members_user_id 
       on voyager.trip_members (user_id);

    alter table if exists voyager.expense_split_amounts 
       add constraint FKlrsbhve4lfycw5wuaeosupqui 
       foreign key (expense_id) 
       references voyager.expenses;

    alter table if exists voyager.expense_split_users 
       add constraint FK8s1vkplo2ykwoy98xmwowxdpk 
       foreign key (expense_id) 
       references voyager.expenses;

    alter table if exists voyager.fuel_leg_riders 
       add constraint FKqxs4cb4bdehnpvwydn7bs4jwp 
       foreign key (fuel_leg_id) 
       references voyager.fuel_legs;

    alter table if exists voyager.idea_attendees 
       add constraint FKhsuic1mnwck6ktojt8oes82rk 
       foreign key (idea_id) 
       references voyager.ideas;
