package com.voyager.backend.chat;

import java.util.UUID;

// Published inside the transaction that saves a message. The socket tells people about it only
// after that transaction has committed (see ChatSocketHandler), so nobody is told about a message
// that cannot be read yet, or one that was rolled back.

public record MessageSent(UUID channelId, UUID messageId) {}
