package com.voyager.backend.demo;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.voyager.backend.common.Session;

import jakarta.servlet.http.HttpSession;

/** Demo-only escape hatch: wipe everything and put the demo trip back. Signs the caller out. */
@RestController
@RequestMapping("/api/demo")
public class DemoController {

    private final DemoData demoData;

    public DemoController(DemoData demoData) {
        this.demoData = demoData;
    }

    @PostMapping("/reset")
    public ResponseEntity<Void> reset(HttpSession session) {
        demoData.reset();
        Session.signOut(session);
        return ResponseEntity.noContent().build();
    }
}
