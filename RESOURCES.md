# Mobile Auth POC Resources

## Knowledge

- [MSG91 Official Documentation](https://docs.msg91.com/)
  The API reference for the provider used in this POC. Use for: understanding the specific payload expected for dual-channel OTP delivery, template formats, and DLT registration steps.
- [Node.js `crypto` module documentation](https://nodejs.org/api/crypto.html)
  The official docs for Node.js cryptography. Use for: understanding `crypto.randomBytes` and `crypto.timingSafeEqual` used in `otp.js` for secure generation and comparison.
- [Redis TTL (Time to Live) documentation](https://redis.io/commands/expire/)
  Redis documentation on key expiration. Use for: explaining how Redis automatically handles the 5-minute OTP expiry and the 60-second cooldown without requiring background cron jobs.

## Wisdom (Communities)

- [r/node](https://reddit.com/r/node)
  A community of Node.js developers. Use for: asking about architecture, best practices for structuring Express apps, or understanding more advanced error handling patterns.
- [Stack Overflow - express tag](https://stackoverflow.com/questions/tagged/express)
  The canonical Q&A site. Use for: debugging specific Express routing or middleware issues if they arise when expanding this POC.

## Gaps
- There is currently no resource listed for learning Mongoose/MongoDB in depth, as the POC uses a very thin slice of it. If you need to expand the `User` model significantly, we'll need to add a trusted Mongoose resource.
