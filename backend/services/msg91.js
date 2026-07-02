/**
 * MSG91 OTP Delivery Service
 * Handles SMS + WhatsApp OTP via MSG91 (India's most cost-effective CPaaS)
 *
 * Pricing (as of 2026):
 *   SMS OTP:        ₹0.15–0.20 / OTP  (transactional DLT route)
 *   WhatsApp Auth:  ₹0.12–0.17 / OTP  (Meta authentication template rate, no MSG91 markup)
 *   vs Twilio:      ₹0.45+    / OTP  (plus forex surcharge ~2-3%)
 *
 * At 5,000–50,000 OTPs/month, MSG91 saves you ~60-70% vs Twilio.
 * Used by Razorpay, Zomato, Swiggy, CRED, ICICI Bank at production scale.
 */

const axios = require("axios");

const MSG91_BASE = "https://api.msg91.com/api/v5";

/**
 * Send OTP via SMS using MSG91's transactional DLT route.
 * Requires DLT-registered sender ID and template.
 */
async function sendSmsOtp(mobile, otp) {
  if (!process.env.MSG91_API_KEY) {
    // Mock mode for POC demo without real credentials
    console.log(`[MOCK SMS] → ${mobile}: OTP is ${otp}`);
    return { success: true, mock: true };
  }

  try {
    const payload = {
      template_id: process.env.MSG91_TEMPLATE_ID,
      mobile: `91${mobile}`,   // prefix with country code
      authkey: process.env.MSG91_API_KEY,
      otp: otp,
      otp_length: parseInt(process.env.OTP_LENGTH || "6"),
      otp_expiry: Math.floor(parseInt(process.env.OTP_EXPIRY_SECONDS || "300") / 60),
    };

    const res = await axios.post(`${MSG91_BASE}/otp`, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 8000,
    });

    if (res.data?.type === "success") {
      return { success: true, requestId: res.data.request_id };
    }
    throw new Error(res.data?.message || "MSG91 SMS failed");
  } catch (err) {
    console.error("[MSG91 SMS Error]", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send OTP via WhatsApp using MSG91's WhatsApp Business API.
 * MSG91 is an official Meta BSP — passes through Meta's auth template rate
 * with zero markup. Current Meta auth rate for India: ~₹0.12/message.
 *
 * Requires:
 *   1. WhatsApp Business Account via MSG91
 *   2. Approved authentication template with {{1}} variable for OTP
 */
async function sendWhatsappOtp(mobile, otp) {
  if (!process.env.MSG91_API_KEY || !process.env.MSG91_WHATSAPP_NUMBER) {
    console.log(`[MOCK WHATSAPP] → ${mobile}: OTP is ${otp}`);
    return { success: true, mock: true };
  }

  try {
    const payload = {
      integrated_number: process.env.MSG91_WHATSAPP_NUMBER,
      content_type: "template",
      payload: {
        to: `91${mobile}`,
        type: "template",
        template: {
          name: "otp_authentication",          // your approved WA template name
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: otp }],
            },
            {
              // WhatsApp native OTP button — auto-fills code on Android
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: otp }],
            },
          ],
        },
      },
    };

    const res = await axios.post(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          authkey: process.env.MSG91_API_KEY,
        },
        timeout: 8000,
      }
    );

    return { success: true, data: res.data };
  } catch (err) {
    console.error("[MSG91 WhatsApp Error]", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Fire both channels simultaneously for maximum delivery speed.
 * At 5K–50K OTPs/month, combined cost is roughly ₹0.27–0.37 per OTP send event.
 */
async function sendOtpBothChannels(mobile, otp) {
  const [smsResult, waResult] = await Promise.allSettled([
    sendSmsOtp(mobile, otp),
    sendWhatsappOtp(mobile, otp),
  ]);

  const sms = smsResult.status === "fulfilled" ? smsResult.value : { success: false };
  const whatsapp = waResult.status === "fulfilled" ? waResult.value : { success: false };

  const anySuccess = sms.success || whatsapp.success;

  return {
    success: anySuccess,
    channels: { sms, whatsapp },
  };
}

module.exports = { sendSmsOtp, sendWhatsappOtp, sendOtpBothChannels };
