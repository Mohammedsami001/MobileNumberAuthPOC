# Provider Decision: SMS + WhatsApp OTP for India

## ✅ Chosen Provider: MSG91

**Website:** https://msg91.com  
**Founded:** 2008, Indore, India  
**Scale:** 10B+ messages/year, 50,000+ customers

---

## Why MSG91?

### Cost Comparison (India, 2026)

| Provider        | SMS OTP / msg | WhatsApp Auth / msg | Combined (both) | Notes                         |
|-----------------|:-------------:|:-------------------:|:---------------:|-------------------------------|
| **MSG91**       | ₹0.15–0.20    | ₹0.12 (Meta rate)   | **~₹0.27–0.32** | No markup on WhatsApp         |
| Message Central | ₹0.20         | ₹0.35–0.50          | ~₹0.55–0.70     | Higher WA rate                |
| Gupshup         | ₹0.17         | ₹0.25–0.35          | ~₹0.42–0.52     | Enterprise-first pricing      |
| 2Factor.in      | ₹0.18–0.25    | Not offered natively| —               | SMS-only specialist           |
| Fast2SMS        | ₹0.10–0.15    | Not offered         | —               | Reliability concerns at scale |
| **Twilio**      | ₹0.45+        | ₹0.45+ (USD forex)  | ~₹0.90+         | +2–3% forex surcharge         |

> At **20,000 OTPs/month** (both channels): MSG91 ≈ ₹6,400 vs Twilio ≈ ₹18,000+  
> **Saving: ~₹11,600/month (~65%)**

---

## Key differentiators

### 1. Zero markup on WhatsApp
MSG91 passes through Meta's official authentication template rate (₹0.12/msg) with no added margin.  
Most providers (WATI, AiSensy, Interakt) add ₹0.10–0.20 markup per message.

### 2. Direct carrier relationships
MSG91 has direct integrations with all four Indian telecoms — Jio, Airtel, Vodafone-Idea, BSNL.  
This means transactional SMS routes are faster (< 3s delivery) with no grey routing.

### 3. DLT compliance built-in
TRAI's DLT mandate (mandatory since 2021) requires every transactional SMS to use a registered sender ID and template.  
MSG91 handles DLT registration, template approvals, and compliance reporting internally.  
Non-compliant providers risk TRAI fines of ₹50,000 per violation.

### 4. Trusted at Indian production scale
Used by: Razorpay, Zomato, Swiggy, CRED, ICICI Bank, Axis Bank, Ola.  
99.9% uptime SLA on Indian carriers. ISO 27001, ISO 9001 certified.

### 5. INR billing, no forex risk
Global providers (Twilio, Vonage, MessageBird) bill in USD, adding 2–3% forex surcharge on every invoice.  
At 50,000 OTPs/month, that's an extra ₹2,000–4,500/month in pure currency overhead.

### 6. Unified API for both channels
One API key, one dashboard, one wallet — covers SMS, WhatsApp, Voice, and Email OTP.  
No need for separate Twilio + Meta BSP integrations.

---

## Providers considered and ruled out

| Provider     | Verdict    | Reason                                                              |
|--------------|:----------:|---------------------------------------------------------------------|
| Twilio       | ❌ Ruled out | 60–70% more expensive; USD billing; excluded by brief               |
| 2Factor.in   | ❌ No WhatsApp | SMS specialist; no native WhatsApp channel for simultaneous sends |
| Fast2SMS     | ❌ Reliability | Known for grey routes on transactional; inconsistent delivery       |
| Gupshup      | ⚠️ Enterprise | Good product but minimum commitments for WhatsApp BSP             |
| Exotel       | ⚠️ Voice-first | Primarily a call platform; SMS/WA are secondary products          |
| Firebase Auth | ❌ No WhatsApp | Phone auth via SMS only; no WhatsApp channel                      |
| Message Central | ⚠️ WA markup | Higher WhatsApp rates; no clear advantage over MSG91              |

---

## Setup checklist (before going live)

1. **Register on MSG91** → https://msg91.com → add ₹500 to wallet (covers ~2,500 OTPs for testing)
2. **DLT Registration** → Register sender ID (6-char, e.g. `VERIFY`) on Vilpower/Smartping  
   Takes 24–48 hours. Approx cost: ₹100–300 one-time via the DLT portal.
3. **SMS Template** → Create and approve OTP template:  
   `Your OTP for login is ##OTP##. Valid for 5 minutes. Do not share. -VERIFY`
4. **WhatsApp BSP onboarding** → Apply via MSG91 dashboard → Meta review takes 2–5 days  
   Requires: Business GST, website, Facebook Business Manager account
5. **WhatsApp Auth Template** → Get approved:  
   `{{1}} is your verification code. For your security, do not share this code.`
6. **Set ENV vars** → Copy `.env.example` to `.env`, fill in `MSG91_API_KEY`, `MSG91_SENDER_ID`, `MSG91_TEMPLATE_ID`, `MSG91_WHATSAPP_NUMBER`

---

## Cost forecast

| Monthly OTPs | SMS cost      | WhatsApp cost | Total        |
|:------------:|:-------------:|:-------------:|:------------:|
| 5,000        | ₹750–1,000    | ₹600          | ~₹1,350–1,600|
| 20,000       | ₹3,000–4,000  | ₹2,400        | ~₹5,400–6,400|
| 50,000       | ₹7,500–10,000 | ₹6,000        | ~₹13,500–16,000|

> Prices exclude 18% GST (standard for B2B services in India).  
> Volume discounts apply at 1L+ OTPs/month — negotiate a custom rate card with MSG91.
