# Mobile Auth POC Glossary

Definitions of key technical and architectural terms used in this authentication project.

## Terms

**OTP (One-Time Password)**:
A secure, auto-expiring 6-digit number generated per login attempt. The phone number serves as the identity, and the OTP serves as the proof of possession.
*Avoid*: PIN code, verification code (in technical contexts)

**TTL (Time-To-Live)**:
A feature of Redis that automatically deletes a key-value pair after a specified number of seconds. Used to auto-expire OTPs, block periods, and cooldowns.
*Avoid*: Expiration timer, cron job

**Timing Attack**:
A security vulnerability where an attacker measures how long a string comparison takes to guess the string (since normal comparison stops early on a mismatch). Prevented by using `crypto.timingSafeEqual`.
*Avoid*: Brute force attack (different concept)

**Mock Mode**:
A development state where external services (like MSG91) are bypassed, and the OTP is instead printed to the console or returned in the API response (only when `NODE_ENV` is not production) to allow local testing without real credentials.
*Avoid*: Fake mode, dummy mode

**MVC (Model-View-Controller) Pattern**:
The architecture dividing the app into data structures (Models in `backend/models`), business logic (Controllers/Services in `backend/services`), and routing (Routes in `backend/routes`).
*Avoid*: Three-tier architecture

**Rate Limiting**:
Restricting how often a user can take an action. In this POC, it includes a 60-second cooldown between OTP sends and a 15-minute block after 3 failed attempts.
*Avoid*: Throttling

**Dual-Channel Delivery**:
Firing both SMS and WhatsApp messages simultaneously via `Promise.allSettled` to maximize the chance of the OTP reaching the user immediately, even if one channel fails or is delayed by the carrier.
*Avoid*: Redundant sending
