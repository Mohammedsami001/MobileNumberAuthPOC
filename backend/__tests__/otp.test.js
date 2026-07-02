/**
 * Integration tests for OTP lifecycle.
 *
 * Mocking strategy (per TDD skill guidelines):
 *   - Redis: mocked at system boundary via ioredis-mock
 *   - Internal modules (otp.js): tested through their public interface
 */

const Redis = require("ioredis-mock");
const { createOtp, verifyOtp, KEY, generateOtp } = require("../services/otp");
const redis = require("../services/redis");

// ── Replace real Redis with mock ──────────────────────────────────────────────
let mockClient;

beforeEach(() => {
  mockClient = new Redis();
  jest.spyOn(redis, "getClient").mockReturnValue(mockClient);
});

afterEach(async () => {
  await mockClient.flushall();
  jest.restoreAllMocks();
});

// ── OTP generation ────────────────────────────────────────────────────────────

describe("generateOtp", () => {
  test("generates a 6-digit numeric string", () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
    expect(parseInt(otp)).toBeGreaterThanOrEqual(100000);
    expect(parseInt(otp)).toBeLessThan(1000000);
  });
});

// ── createOtp ─────────────────────────────────────────────────────────────────

describe("createOtp", () => {
  test("returns a 6-digit OTP on success", async () => {
    const result = await createOtp("9876543210");
    expect(result.success).toBe(true);
    expect(result.otp).toMatch(/^\d{6}$/);
  });

  test("stores the OTP in Redis with a TTL", async () => {
    const result = await createOtp("9876543210");
    const stored = await mockClient.get(KEY.otp("9876543210"));
    expect(stored).toBe(result.otp);

    const ttl = await mockClient.ttl(KEY.otp("9876543210"));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(300);
  });

  test("blocks resend within cooldown period", async () => {
    await createOtp("9876543210");
    const result = await createOtp("9876543210");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("COOLDOWN");
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  test("refuses OTP creation for blocked numbers", async () => {
    // Manually set a block key
    await mockClient.set(KEY.block("9876543210"), "1", "EX", 900);

    const result = await createOtp("9876543210");
    expect(result.success).toBe(false);
    expect(result.reason).toBe("BLOCKED");
  });
});

// ── verifyOtp ─────────────────────────────────────────────────────────────────

describe("verifyOtp", () => {
  test("succeeds with correct OTP", async () => {
    const { otp } = await createOtp("9876543210");
    const result = await verifyOtp("9876543210", otp);
    expect(result.success).toBe(true);
  });

  test("cleans up OTP keys after successful verification", async () => {
    const { otp } = await createOtp("9876543210");
    await verifyOtp("9876543210", otp);

    const stored = await mockClient.get(KEY.otp("9876543210"));
    expect(stored).toBeNull();
  });

  test("returns EXPIRED when no OTP exists", async () => {
    const result = await verifyOtp("9876543210", "123456");
    expect(result.success).toBe(false);
    expect(result.reason).toBe("EXPIRED");
  });

  test("returns INVALID with wrong OTP and tracks remaining attempts", async () => {
    await createOtp("9876543210");
    const result = await verifyOtp("9876543210", "000000");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("INVALID");
    expect(result.attemptsLeft).toBe(2);
  });

  test("blocks after 3 failed attempts", async () => {
    await createOtp("9876543210");

    await verifyOtp("9876543210", "000001");
    await verifyOtp("9876543210", "000002");
    const result = await verifyOtp("9876543210", "000003");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("MAX_ATTEMPTS");
    expect(result.retryAfter).toBe(900);
  });

  test("refuses verification for blocked numbers", async () => {
    await mockClient.set(KEY.block("9876543210"), "1", "EX", 900);

    const result = await verifyOtp("9876543210", "123456");
    expect(result.success).toBe(false);
    expect(result.reason).toBe("BLOCKED");
  });
});
