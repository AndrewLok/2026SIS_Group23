package com.voyager.backend.demo;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import com.voyager.backend.user.UserRepository;

/** The database is in memory, so every start begins empty: put the demo trip back. */
@Component
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
