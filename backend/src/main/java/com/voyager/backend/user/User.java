package com.voyager.backend.user;

import com.voyager.backend.common.Ids;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User {

    @Id
    private String id;

    @Column(nullable = false)
    private String displayName; // The one name the group sees, e.g. "Priya Raman".

    @Column(nullable = false, unique = true)
    private String email; // Always stored trimmed and lowercase.

    @Column(nullable = false)
    private String passwordHash;

    private int avatarHue; // 0 to 359, picks the avatar colour.

    public User() {}

    public User(String displayName, String email, String passwordHash, int avatarHue) {
        this(Ids.newId(), displayName, email, passwordHash, avatarHue);
    }

    /** With a fixed id, for the demo seed. */
    public User(String id, String displayName, String email, String passwordHash, int avatarHue) {
        this.id = id;
        this.displayName = displayName;
        this.email = email;
        this.passwordHash = passwordHash;
        this.avatarHue = avatarHue;
    }

    public String getId() { return id; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public int getAvatarHue() { return avatarHue; }
}
