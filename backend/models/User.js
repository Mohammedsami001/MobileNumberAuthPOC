const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: /^[6-9]\d{9}$/,   // Indian mobile number validation
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    dateOfBirth: {
      type: Date,
    },
    city: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    isVerified: {
      type: Boolean,
      default: true,   // If in DB, mobile was already verified
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    loginCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Update lastLogin on each auth
userSchema.methods.recordLogin = async function () {
  this.lastLogin = new Date();
  this.loginCount += 1;
  return this.save();
};

// Safe profile — never expose internal DB fields
userSchema.methods.toProfile = function () {
  return {
    id: this._id,
    mobile: this.mobile,
    name: this.name || null,
    email: this.email || null,
    city: this.city || null,
    dateOfBirth: this.dateOfBirth || null,
    memberSince: this.createdAt,
    lastLogin: this.lastLogin,
    loginCount: this.loginCount,
  };
};

module.exports = mongoose.model("User", userSchema);
