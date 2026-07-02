/**
 * Integration tests for auth routes.
 *
 * Mocking strategy (per TDD skill guidelines):
 *   - Redis: ioredis-mock (system boundary)
 *   - MongoDB: mongodb-memory-server (system boundary, real Mongoose)
 *   - MSG91 HTTP calls: never made (mock mode — no API key set)
 *   - Internal modules: NOT mocked — tested through Express HTTP interface
 */

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Redis = require("ioredis-mock");
const redis = require("../services/redis");

let mongoServer;
let mockRedis;
let app;

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // In-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Mock Redis
  mockRedis = new Redis();
  jest.spyOn(redis, "getClient").mockReturnValue(mockRedis);

  // Ensure mock mode (no MSG91 key)
  delete process.env.MSG91_API_KEY;
  delete process.env.NODE_ENV;

  // Load app AFTER mocks are in place
  app = require("../server").app;
});

afterEach(async () => {
  await mockRedis.flushall();
  // Clean up User collection between tests
  const User = require("../models/User");
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  jest.restoreAllMocks();
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function sendOtp(mobile) {
  return request(app)
    .post("/auth/send-otp")
    .send({ mobile })
    .expect("Content-Type", /json/);
}

async function verifyOtp(mobile, otp) {
  return request(app)
    .post("/auth/verify-otp")
    .send({ mobile, otp })
    .expect("Content-Type", /json/);
}

async function registerUser(mobile, name, extras = {}) {
  return request(app)
    .post("/auth/register")
    .send({ mobile, name, ...extras })
    .expect("Content-Type", /json/);
}

// ── POST /auth/send-otp ───────────────────────────────────────────────────────

describe("POST /auth/send-otp", () => {
  test("sends OTP for valid Indian mobile number", async () => {
    const res = await sendOtp("9876543210");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("OTP sent");
  });

  test("returns dev OTP in mock mode (non-production)", async () => {
    const res = await sendOtp("9876543210");

    expect(res.body._devOtp).toBeDefined();
    expect(res.body._devOtp).toMatch(/^\d{6}$/);
  });

  test("rejects invalid mobile number", async () => {
    const res = await sendOtp("12345");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("enforces cooldown on rapid resend", async () => {
    await sendOtp("9876543210");
    const res = await sendOtp("9876543210");

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
  });
});

// ── POST /auth/verify-otp ─────────────────────────────────────────────────────

describe("POST /auth/verify-otp", () => {
  test("verifies correct OTP for new user", async () => {
    const sendRes = await sendOtp("9876543210");
    const otp = sendRes.body._devOtp;

    const res = await verifyOtp("9876543210", otp);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isNewUser).toBe(true);
  });

  test("rejects wrong OTP", async () => {
    await sendOtp("9876543210");
    const res = await verifyOtp("9876543210", "000000");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.reason).toBe("INVALID");
  });

  test("returns existing user profile after OTP verification", async () => {
    // First: register a user through the full flow
    const sendRes1 = await sendOtp("9876543210");
    await verifyOtp("9876543210", sendRes1.body._devOtp);
    await registerUser("9876543210", "Priya Sharma");

    // Second login: send + verify again
    await mockRedis.flushall(); // clear cooldown
    const sendRes2 = await sendOtp("9876543210");
    const res = await verifyOtp("9876543210", sendRes2.body._devOtp);

    expect(res.body.success).toBe(true);
    expect(res.body.isNewUser).toBe(false);
    expect(res.body.profile.name).toBe("Priya Sharma");
  });
});

// ── POST /auth/register ───────────────────────────────────────────────────────

describe("POST /auth/register", () => {
  test("registers new user after OTP verification", async () => {
    // Full flow: send → verify → register
    const sendRes = await sendOtp("9876543210");
    await verifyOtp("9876543210", sendRes.body._devOtp);

    const res = await registerUser("9876543210", "Priya Sharma", {
      email: "priya@example.com",
      city: "Mumbai",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.profile.name).toBe("Priya Sharma");
    expect(res.body.profile.mobile).toBe("9876543210");
  });

  test("rejects registration without prior OTP verification", async () => {
    const res = await registerUser("9876543210", "Priya Sharma");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("verified");
  });

  test("rejects registration for already existing user", async () => {
    // Register once
    const sendRes = await sendOtp("9876543210");
    await verifyOtp("9876543210", sendRes.body._devOtp);
    await registerUser("9876543210", "Priya Sharma");

    // Try to register again — need to re-verify first
    await mockRedis.flushall();
    const sendRes2 = await sendOtp("9876543210");
    await verifyOtp("9876543210", sendRes2.body._devOtp);

    const res = await registerUser("9876543210", "Different Name");
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test("rejects registration with short name", async () => {
    const sendRes = await sendOtp("9876543210");
    await verifyOtp("9876543210", sendRes.body._devOtp);

    const res = await registerUser("9876543210", "A");
    expect(res.status).toBe(400);
  });
});

// ── Mock-mode OTP leak guard ──────────────────────────────────────────────────

describe("mock-mode OTP leak guard", () => {
  test("does not expose OTP when NODE_ENV is production", async () => {
    process.env.NODE_ENV = "production";

    const res = await sendOtp("9876543210");

    expect(res.body._devOtp).toBeUndefined();
    expect(res.body.success).toBe(true);

    delete process.env.NODE_ENV;
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe("error handling", () => {
  test("returns 500 JSON on unexpected error, not raw stack trace", async () => {
    // Force an error by temporarily breaking the Redis mock
    const origGet = mockRedis.get.bind(mockRedis);
    mockRedis.get = jest.fn().mockRejectedValue(new Error("Redis connection lost"));

    const res = await request(app)
      .post("/auth/verify-otp")
      .send({ mobile: "9876543210", otp: "123456" });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Internal server error.");
    // Should NOT contain a stack trace
    expect(res.text).not.toContain("Error:");
    expect(res.text).not.toContain("at ");

    mockRedis.get = origGet;
  });
});

// ── GET /auth/profile/:mobile ─────────────────────────────────────────────────

describe("GET /auth/profile/:mobile", () => {
  test("returns profile for existing user", async () => {
    // Create user through full flow
    const sendRes = await sendOtp("9876543210");
    await verifyOtp("9876543210", sendRes.body._devOtp);
    await registerUser("9876543210", "Priya Sharma", { city: "Mumbai" });

    const res = await request(app).get("/auth/profile/9876543210");

    expect(res.status).toBe(200);
    expect(res.body.profile.name).toBe("Priya Sharma");
    expect(res.body.profile.city).toBe("Mumbai");
  });

  test("returns 404 for unknown mobile", async () => {
    const res = await request(app).get("/auth/profile/9999999999");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
