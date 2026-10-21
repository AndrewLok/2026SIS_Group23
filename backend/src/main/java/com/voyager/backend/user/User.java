package com.voyager.backend.user;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // The single name the group recognises this person by.
    @Column(nullable = false)
    private String displayName;

    @Column(nullable = false, unique = true)
    private String email; // Always stored trimmed and lower-cased.

    @Column(nullable = false)
    private String passwordHash;

    // 0-359. Picks the colour of the member's avatar, so it is stable across screens and devices.
    @Column(nullable = false)
    private int avatarHue;

    public User() {}

    public User(String displayName, String email, String passwordHash, int avatarHue) {
        this.displayName = displayName;
        this.email = email;
        this.passwordHash = passwordHash;
        this.avatarHue = avatarHue;
    }

    public UUID getId() { return id; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public int getAvatarHue() { return avatarHue; }
    public void setAvatarHue(int avatarHue) { this.avatarHue = avatarHue; }
}
