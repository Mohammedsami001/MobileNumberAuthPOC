# Mobile Number Authentication POC

> **Provider:** MSG91 (cheapest for India — SMS + WhatsApp, no Twilio)  
> **Stack:** Node.js + Express · Redis · MongoDB · Vanilla JS frontend  
> **OTP channels:** SMS + WhatsApp simultaneously (MSG91's dual-channel API)

---

## Architecture

```
User Browser (index.html)
       │
       ▼
Express Server (server.js)
  ├── POST /auth/send-otp     → generate OTP → Redis (TTL 5min) → MSG91 (SMS + WA)
  ├── POST /auth/verify-otp   → check Redis → return isNewUser flag
  ├── POST /auth/register     → save to MongoDB → return profile
  └── GET  /auth/profile/:mob → fetch from MongoDB
       │
  ┌────┴────┐
Redis     MongoDB
(OTP TTL) (Users)
```

## Auth flow

```
Enter Mobile → [Send OTP] → SMS + WhatsApp fire simultaneously
     ↓
Enter 6-digit OTP → [Verify]
     ↓
  OTP Invalid? → Show error, count attempts, block after 3 failures
     ↓
  New user?  → Account creation form → Dashboard
  Existing?  → Dashboard with profile
```

---

## Quick start

### Prerequisites
- Node.js 18+
- Redis (local or Redis Cloud free tier)
- MongoDB (local or Atlas free tier)
- MSG91 account (or run in mock mode without credentials)

### Install

```bash
cd backend
npm install
```

### Configure

```bash
cp .env.example .env
# Edit .env — add your MSG91 credentials, Redis URL, MongoDB URI
```

**Without credentials (mock mode):** Leave `MSG91_API_KEY` blank.  
The server will print the OTP to console and return it in the API response as `_devOtp`.  
The frontend will display it in a blue banner — perfect for local testing.

### Run

```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start MongoDB (if local)
mongod

# Terminal 3: Start app
cd backend
node server.js
```

Open http://localhost:3000

---

## API reference

### `POST /auth/send-otp`
```json
// Request
{ "mobile": "9876543210" }

// Response (success)
{ "success": true, "message": "OTP sent via SMS and WhatsApp." }

// Response (mock mode adds)
{ "_devOtp": "482931", "_note": "Mock mode..." }

// Response (cooldown)
{ "success": false, "message": "Wait 45 seconds before requesting again." }
```

### `POST /auth/verify-otp`
```json
// Request
{ "mobile": "9876543210", "otp": "482931" }

// Response (new user)
{ "success": true, "isNewUser": true }

// Response (existing user)
{ "success": true, "isNewUser": false, "profile": { ... } }

// Response (wrong OTP)
{ "success": false, "reason": "INVALID", "message": "Incorrect OTP. 2 attempt(s) remaining." }
```

### `POST /auth/register`
```json
// Request
{
  "mobile": "9876543210",
  "name": "Priya Sharma",
  "email": "priya@example.com",
  "city": "Mumbai",
  "dateOfBirth": "1995-06-15"
}

// Response
{ "success": true, "profile": { "id": "...", "name": "Priya Sharma", ... } }
```

### `GET /auth/profile/:mobile`
```json
// Response
{
  "success": true,
  "profile": {
    "id": "...",
    "mobile": "9876543210",
    "name": "Priya Sharma",
    "email": "priya@example.com",
    "city": "Mumbai",
    "memberSince": "2026-07-02T...",
    "lastLogin": "2026-07-02T...",
    "loginCount": 3
  }
}
```

---

## Security notes

- OTPs generated with `crypto.randomBytes` (not `Math.random`)
- Verification uses `crypto.timingSafeEqual` to prevent timing attacks
- 3 failed attempts → 15-minute block (stored in Redis)
- 60-second resend cooldown (Redis key with TTL)
- OTP auto-expires after 5 minutes (Redis TTL)
- In production: add JWT session tokens after verification

---

## Provider rationale

See [PROVIDER_DECISION.md](./PROVIDER_DECISION.md) for full comparison.

**TL;DR:** MSG91 is 60–70% cheaper than Twilio for Indian numbers, handles both SMS and WhatsApp with a single API, passes through Meta's WhatsApp auth rate with zero markup, and has direct carrier relationships with Jio/Airtel/Vi/BSNL for fast transactional delivery.

At your target volume (5K–50K OTPs/month), MSG91 costs roughly **₹1,350–16,000/month** for both channels combined.  
Twilio equivalent would be **₹4,500–45,000+/month** with forex surcharge.
