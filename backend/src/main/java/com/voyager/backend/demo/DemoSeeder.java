package com.voyager.backend.demo;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.voyager.backend.user.UserRepository;

/**
 * Puts the demo trip in when the database has no users. In memory that is every start; on
 * Supabase it is only the first, after which the data is kept. Off with voyager.demo.seed=false.
 */
@Component
@ConditionalOnProperty(name = "voyager.demo.seed", havingValue = "true", matchIfMissing = true)
public class DemoSeeder implements ApplicationRunner {

    private final DemoData demoData;
    private final UserRepository userRepository;

    public DemoSeeder(DemoData demoData, UserRepository userRepository) {
        this.demoData = demoData;
        this.userRepository = userRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.count() == 0) demoData.seed();
    }
}
