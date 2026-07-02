const express = require("express");
const router = express.Router();
const { createOtp, verifyOtp } = require("../services/otp");
const { sendOtpBothChannels } = require("../services/msg91");
const redis = require("../services/redis");
const User = require("../models/User");

// ── Input validators ──────────────────────────────────────────────────────────

function isValidIndianMobile(mobile) {
  return /^[6-9]\d{9}$/.test(mobile);
}

// ── Async wrapper ─────────────────────────────────────────────────────────────
// Catches async errors and forwards them to Express error middleware
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ── Verification key ──────────────────────────────────────────────────────────
const VERIFIED_KEY = (mobile) => `verified:${mobile}`;
const VERIFIED_TTL = 600; // 10 minutes to complete registration after OTP verify

// ── POST /auth/send-otp ───────────────────────────────────────────────────────
/**
 * Step 1: User submits mobile number.
 * Generates OTP → stores in Redis → fires SMS + WhatsApp simultaneously.
 */
router.post("/send-otp", asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  if (!mobile || !isValidIndianMobile(String(mobile))) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid 10-digit Indian mobile number.",
    });
  }

  const { success, otp, reason, retryAfter } = await createOtp(String(mobile));

  if (!success) {
    const messages = {
      BLOCKED: `Too many failed attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      COOLDOWN: `OTP already sent. Wait ${retryAfter} seconds before requesting again.`,
    };
    return res.status(429).json({ success: false, message: messages[reason] });
  }

  // Fire both channels simultaneously
  const deliveryResult = await sendOtpBothChannels(mobile, otp);

  if (!deliveryResult.success) {
    return res.status(502).json({
      success: false,
      message: "Could not send OTP right now. Please try again.",
    });
  }

  const isMock = deliveryResult.channels.sms?.mock || deliveryResult.channels.whatsapp?.mock;

  // Only expose OTP in dev/test — never in production, even if MSG91 keys are missing
  const showDevOtp = isMock && process.env.NODE_ENV !== "production";

  return res.json({
    success: true,
    message: "OTP sent via SMS and WhatsApp.",
    ...(showDevOtp && {
      _devOtp: otp,
      _note: "Mock mode — real MSG91 credentials not configured.",
    }),
  });
}));

// ── POST /auth/verify-otp ─────────────────────────────────────────────────────
/**
 * Step 2: User submits OTP for verification.
 * Returns:
 *   - isNewUser: true  → frontend shows registration form
 *   - isNewUser: false → frontend redirects to dashboard
 */
router.post("/verify-otp", asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;

  if (!mobile || !otp) {
    return res.status(400).json({ success: false, message: "Mobile and OTP are required." });
  }

  const result = await verifyOtp(String(mobile), String(otp));

  if (!result.success) {
    const messages = {
      EXPIRED:      "OTP has expired. Please request a new one.",
      INVALID:      `Incorrect OTP. ${result.attemptsLeft} attempt(s) remaining.`,
      MAX_ATTEMPTS: `Too many wrong attempts. Try again in ${Math.ceil(result.retryAfter / 60)} minutes.`,
      BLOCKED:      `Account temporarily locked. Try again in ${Math.ceil(result.retryAfter / 60)} minutes.`,
    };
    return res.status(401).json({
      success: false,
      message: messages[result.reason] || "OTP verification failed.",
      reason: result.reason,
    });
  }

  // Mark this mobile as verified (allows registration within TTL window)
  const client = redis.getClient();
  await client.set(VERIFIED_KEY(mobile), "1", "EX", VERIFIED_TTL);

  // OTP verified — check if user exists
  let user = await User.findOne({ mobile: String(mobile) });
  const isNewUser = !user;

  if (!isNewUser) {
    await user.recordLogin();
  }

  return res.json({
    success: true,
    isNewUser,
    ...(isNewUser ? {} : { profile: user.toProfile() }),
  });
}));

// ── POST /auth/register ───────────────────────────────────────────────────────
/**
 * Step 3a (new users only): Create account with basic details.
 * Mobile must have been OTP-verified in this session (checked via Redis key).
 */
router.post("/register", asyncHandler(async (req, res) => {
  const { mobile, name, email, city, dateOfBirth } = req.body;

  if (!mobile || !isValidIndianMobile(String(mobile))) {
    return res.status(400).json({ success: false, message: "Invalid mobile number." });
  }

  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ success: false, message: "Please enter your full name." });
  }

  // Gate: require OTP verification before registration
  const client = redis.getClient();
  const verified = await client.get(VERIFIED_KEY(String(mobile)));
  if (!verified) {
    return res.status(403).json({
      success: false,
      message: "Mobile number must be verified before registration.",
    });
  }

  // Guard: don't allow registration if user already exists
  const existing = await User.findOne({ mobile: String(mobile) });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: "Account already exists for this number.",
      profile: existing.toProfile(),
    });
  }

  const user = new User({
    mobile: String(mobile),
    name: String(name).trim(),
    email: email ? String(email).trim() : undefined,
    city: city ? String(city).trim() : undefined,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    loginCount: 1,
    lastLogin: new Date(),
  });

  await user.save();

  // Clean up verification key after successful registration
  await client.del(VERIFIED_KEY(String(mobile)));

  return res.status(201).json({
    success: true,
    message: "Account created successfully.",
    profile: user.toProfile(),
  });
}));

// ── GET /auth/profile/:mobile ─────────────────────────────────────────────────
/**
 * Dashboard: fetch user profile.
 * In production this would be a JWT-protected endpoint.
 */
router.get("/profile/:mobile", asyncHandler(async (req, res) => {
  const user = await User.findOne({ mobile: req.params.mobile });

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  return res.json({ success: true, profile: user.toProfile() });
}));

module.exports = router;
