import type { FastifyInstance } from "fastify";
import { prisma } from "@nova/database";
import {
  authenticate,
  hashPassword,
  isPasswordStrong,
  logout,
  refreshSession,
  generateTOTPSecret,
  verifyTOTP,
  generateOTPCode,
} from "@nova/auth";
import { sendEmail } from "../utils/email.js";

const registerBodySchema = {
  type: "object" as const,
  required: ["email", "username", "password", "displayName", "acceptTos", "acceptAge"],
  properties: {
    email: { type: "string" as const, format: "email", minLength: 3 },
    username: { type: "string" as const, minLength: 3, maxLength: 24, pattern: "^[a-zA-Z0-9_]+$" },
    password: { type: "string" as const, minLength: 8, maxLength: 128 },
    displayName: { type: "string" as const, minLength: 1, maxLength: 40 },
    acceptTos: { type: "boolean" as const, enum: [true] },
    acceptAge: { type: "boolean" as const, enum: [true] },
    referralCode: { type: "string" as const },
  },
  additionalProperties: false,
};

const loginBodySchema = {
  type: "object" as const,
  required: ["identifier", "password"],
  properties: {
    identifier: { type: "string" as const, minLength: 3 },
    password: { type: "string" as const, minLength: 8, maxLength: 128 },
  },
  additionalProperties: false,
};

const googleLoginBodySchema = {
  type: "object" as const,
  required: ["credential"],
  properties: {
    credential: { type: "string" as const },
  },
  additionalProperties: false,
};

const refreshBodySchema = {
  type: "object" as const,
  required: ["refreshToken"],
  properties: { refreshToken: { type: "string" as const } },
  additionalProperties: false,
};

const setupTotpBodySchema = {
  type: "object" as const,
  required: ["userId", "token"],
  properties: {
    userId: { type: "string" as const },
    token: { type: "string" as const, minLength: 6, maxLength: 6 },
  },
  additionalProperties: false,
};

const verifyTotpBodySchema = {
  type: "object" as const,
  required: ["userId", "token"],
  properties: {
    userId: { type: "string" as const },
    token: { type: "string" as const, minLength: 6, maxLength: 6 },
  },
  additionalProperties: false,
};

const verifyEmailBodySchema = {
  type: "object" as const,
  required: ["userId", "code"],
  properties: {
    userId: { type: "string" as const },
    code: { type: "string" as const, minLength: 6, maxLength: 6 },
  },
  additionalProperties: false,
};

const resendEmailOtpBodySchema = {
  type: "object" as const,
  required: ["userId"],
  properties: {
    userId: { type: "string" as const },
  },
  additionalProperties: false,
};

export const authRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post(
    "/register",
    { schema: { body: registerBodySchema } },
    async (req, reply) => {
      const body = req.body as any;
      if (!isPasswordStrong(body.password)) {
        return reply.code(400).send({
          error: { code: "weak_password", message: "Password too weak" },
        });
      }
      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ email: body.email.toLowerCase() }, { username: body.username }],
        },
      });
      if (existing) {
        return reply.code(409).send({
          error: { code: "user_exists", message: "Email or username already registered" },
        });
      }
      const passwordHash = await hashPassword(body.password);
      
      const hasReferral = typeof body.referralCode === "string" && body.referralCode.trim() !== "";
      const referralCode = hasReferral ? body.referralCode.trim() : null;

      const user = await prisma.user.create({
        data: {
          email: body.email.toLowerCase(),
          username: body.username,
          displayName: body.displayName,
          passwordHash,
          referralCode,
        },
      });

      if (referralCode) {
        const referrer = await prisma.user.findFirst({ where: { referralCode } });
        if (referrer) {
          await prisma.referral.create({
            data: {
              referrerId: referrer.id,
              referredId: user.id,
              code: referralCode,
            },
          });
        }
      }

      // Generate Email verification OTP
      const emailOtp = generateOTPCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await prisma.user.update({
        where: { id: user.id },
        data: { emailOtpCode: emailOtp, emailOtpExpiresAt: expiresAt },
      });

      console.log(`[Registration] Email verification OTP for ${user.email}: ${emailOtp}`);

      // Send actual email using Nodemailer
      await sendEmail({
        to: user.email,
        subject: "Verify your email address - Nova Royale",
        text: `Welcome to Nova Royale! Your email verification code is: ${emailOtp}. This code expires in 15 minutes.`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
            <h2 style="color: #7c5cff; text-align: center;">Welcome to Nova Royale!</h2>
            <p>Thank you for signing up. Please verify your email address by entering the code below on the signup screen:</p>
            <div style="background: #f4f2ff; border: 1px solid #7c5cff; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
              <span style="font-size: 28px; letter-spacing: 4px; font-family: monospace; color: #7c5cff; font-weight: bold;">${emailOtp}</span>
            </div>
            <p style="color: #666; font-size: 13px;">This code will expire in 15 minutes. If you did not create an account on Nova Royale, please ignore this email.</p>
          </div>
        `
      });

      return reply.send({
        status: "email_verification_required",
        userId: user.id,
        devEmailOtpCode: emailOtp, // Always return code in demo for easy testing
      });
    }
  );

  app.post(
    "/register/verify-email",
    { schema: { body: verifyEmailBodySchema } },
    async (req, reply) => {
      const { userId, code } = req.body as { userId: string; code: string };
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (
        !user ||
        !user.emailOtpCode ||
        !user.emailOtpExpiresAt ||
        user.emailOtpExpiresAt < new Date()
      ) {
        return reply.code(400).send({
          error: { code: "invalid_request", message: "Verification code expired or invalid" },
        });
      }

      if (user.emailOtpCode !== code) {
        return reply.code(400).send({
          error: { code: "invalid_code", message: "Invalid verification code" },
        });
      }

      // Clear OTP and set emailVerifiedAt
      await prisma.user.update({
        where: { id: userId },
        data: {
          emailOtpCode: null,
          emailOtpExpiresAt: null,
          emailVerifiedAt: new Date(),
        },
      });

      // Generate access and refresh tokens to log in
      const { signAccessToken, signRefreshToken, sha256 } = await import("@nova/auth");
      const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL ?? 60 * 60 * 24 * 30);
      
      const claims = { sub: user.id, role: user.role, username: user.username };
      const accessToken = signAccessToken(claims);
      const refreshToken = signRefreshToken(claims);
      const tokenHash = sha256(refreshToken);

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          ip: req.ip,
          device: req.headers["user-agent"] ?? "",
          expiresAt: new Date(Date.now() + REFRESH_TTL * 1000),
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), lastLoginIp: req.ip },
      });

      const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL ?? 900);

      return reply.send({
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TTL,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
      });
    }
  );

  app.post(
    "/register/resend-email-otp",
    { schema: { body: resendEmailOtpBodySchema } },
    async (req, reply) => {
      const { userId } = req.body as { userId: string };
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return reply.code(400).send({
          error: { code: "invalid_request", message: "Invalid request" },
        });
      }

      if (user.emailVerifiedAt) {
        return reply.code(400).send({
          error: { code: "already_verified", message: "Email is already verified" },
        });
      }

      // Generate new Email OTP (Factor 3)
      const emailOtp = generateOTPCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await prisma.user.update({
        where: { id: userId },
        data: { emailOtpCode: emailOtp, emailOtpExpiresAt: expiresAt },
      });

      // Log OTP
      console.log(`[Registration] Resent email verification OTP for user ${user.email}: ${emailOtp}`);

      // Send actual email using Nodemailer
      await sendEmail({
        to: user.email,
        subject: "Verify your email address - Nova Royale",
        text: `Your new email verification code is: ${emailOtp}. This code expires in 15 minutes.`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
            <h2 style="color: #7c5cff; text-align: center;">Verify your email</h2>
            <p>You requested a new verification code. Please enter the code below on the verification screen:</p>
            <div style="background: #f4f2ff; border: 1px solid #7c5cff; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
              <span style="font-size: 28px; letter-spacing: 4px; font-family: monospace; color: #7c5cff; font-weight: bold;">${emailOtp}</span>
            </div>
            <p style="color: #666; font-size: 13px;">This code will expire in 15 minutes. If you did not request this, you can safely ignore this email.</p>
          </div>
        `
      });

      return reply.send({
        status: "email_verification_required",
        userId: user.id,
        devEmailOtpCode: emailOtp, // Always return code in demo for easy testing
      });
    }
  );

  app.post(
    "/login",
    { schema: { body: loginBodySchema } },
    async (req, reply) => {
      const body = req.body as any;
      try {
        const user = await prisma.user.findFirst({
          where: {
            OR: [{ email: body.identifier.toLowerCase() }, { username: body.identifier }],
          },
        });
        if (!user) {
          return reply.code(401).send({
            error: { code: "invalid_credentials", message: "Invalid credentials" },
          });
        }

        const { verifyPassword } = await import("@nova/auth");
        const ok = await verifyPassword(body.password, user.passwordHash);
        if (!ok) {
          return reply.code(401).send({
            error: { code: "invalid_credentials", message: "Invalid credentials" },
          });
        }

        // If user is admin/superadmin, trigger 3FA
        if (user.role === "admin" || user.role === "superadmin") {
          if (!user.totpEnabled) {
            // Setup TOTP
            const secret = generateTOTPSecret();
            await prisma.user.update({
              where: { id: user.id },
              data: { totpSecret: secret },
            });
            const totpUri = `otpauth://totp/NovaRoyale:${user.email}?secret=${secret}&issuer=NovaRoyale`;
            return reply.send({
              status: "mfa_setup",
              userId: user.id,
              totpSecret: secret,
              totpUri,
            });
          } else {
            return reply.send({
              status: "mfa_totp_required",
              userId: user.id,
            });
          }
        }

        const result = await authenticate({
          identifier: body.identifier,
          password: body.password,
          ip: req.ip,
          userAgent: req.headers["user-agent"] ?? "",
        });
        return reply.send(result);
      } catch (err) {
        return reply.code(401).send({
          error: { code: "invalid_credentials", message: "Invalid credentials" },
        });
      }
    }
  );

  app.post(
    "/google-login",
    { schema: { body: googleLoginBodySchema } },
    async (req, reply) => {
      const { credential } = req.body as { credential: string };

      // Verify Google ID token
      let payload;
      try {
        const verifyRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
        );
        if (!verifyRes.ok) {
          throw new Error("Invalid Google token");
        }
        payload = await verifyRes.json() as { email?: string; email_verified?: string };
      } catch (err) {
        return reply.code(400).send({
          error: { code: "invalid_token", message: "Failed to verify Google account" },
        });
      }

      if (!payload.email || payload.email_verified !== "true") {
        return reply.code(400).send({
          error: { code: "email_unverified", message: "Google email is not verified" },
        });
      }

      const email = payload.email.toLowerCase();

      // Find user
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return reply.code(401).send({
          error: { code: "access_denied", message: "No admin user found with this Google email. Access denied." },
        });
      }

      // Ensure they have admin access
      if (user.role !== "admin" && user.role !== "superadmin") {
        return reply.code(403).send({
          error: { code: "forbidden", message: "Access denied. Admin role required." },
        });
      }

      // Check if TOTP is enabled
      if (user.totpEnabled) {
        return reply.send({
          status: "mfa_totp_required",
          userId: user.id,
        });
      }

      // If TOTP is NOT setup, generate a secret and trigger setup
      const secret = generateTOTPSecret();
      await prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: secret },
      });
      const totpUri = `otpauth://totp/NovaRoyale:${user.email}?secret=${secret}&issuer=NovaRoyale`;
      return reply.send({
        status: "mfa_setup",
        userId: user.id,
        totpSecret: secret,
        totpUri,
      });
    }
  );

  app.post(
    "/mfa/setup-totp",
    { schema: { body: setupTotpBodySchema } },
    async (req, reply) => {
      const { userId, token } = req.body as { userId: string; token: string };
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.totpSecret) {
        return reply.code(400).send({
          error: { code: "invalid_request", message: "Invalid request" },
        });
      }

      const verified = verifyTOTP(token, user.totpSecret);
      if (!verified) {
        return reply.code(400).send({
          error: { code: "invalid_token", message: "Invalid verification code" },
        });
      }

      // Enable TOTP and clear email OTP fields
      await prisma.user.update({
        where: { id: userId },
        data: { totpEnabled: true, emailOtpCode: null, emailOtpExpiresAt: null },
      });

      // Generate access and refresh tokens to log in directly (2FA complete)
      const { signAccessToken, signRefreshToken, sha256 } = await import("@nova/auth");
      const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL ?? 60 * 60 * 24 * 30);
      
      const claims = { sub: user.id, role: user.role, username: user.username };
      const accessToken = signAccessToken(claims);
      const refreshToken = signRefreshToken(claims);
      const tokenHash = sha256(refreshToken);

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          ip: req.ip,
          device: req.headers["user-agent"] ?? "",
          expiresAt: new Date(Date.now() + REFRESH_TTL * 1000),
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), lastLoginIp: req.ip },
      });

      const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL ?? 900);

      return reply.send({
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TTL,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
      });
    }
  );

  app.post(
    "/mfa/verify-totp",
    { schema: { body: verifyTotpBodySchema } },
    async (req, reply) => {
      const { userId, token } = req.body as { userId: string; token: string };
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.totpSecret || !user.totpEnabled) {
        return reply.code(400).send({
          error: { code: "invalid_request", message: "Invalid request" },
        });
      }

      const verified = verifyTOTP(token, user.totpSecret);
      if (!verified) {
        return reply.code(400).send({
          error: { code: "invalid_token", message: "Invalid verification code" },
        });
      }

      // Generate access and refresh tokens to log in directly (2FA complete)
      const { signAccessToken, signRefreshToken, sha256 } = await import("@nova/auth");
      const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL ?? 60 * 60 * 24 * 30);
      
      const claims = { sub: user.id, role: user.role, username: user.username };
      const accessToken = signAccessToken(claims);
      const refreshToken = signRefreshToken(claims);
      const tokenHash = sha256(refreshToken);

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          ip: req.ip,
          device: req.headers["user-agent"] ?? "",
          expiresAt: new Date(Date.now() + REFRESH_TTL * 1000),
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), lastLoginIp: req.ip },
      });

      const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL ?? 900);

      return reply.send({
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TTL,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
      });
    }
  );

  app.post(
    "/refresh",
    { schema: { body: refreshBodySchema } },
    async (req, reply) => {
      const body = req.body as { refreshToken: string };
      try {
        const result = await refreshSession(body.refreshToken);
        return reply.send(result);
      } catch {
        return reply.code(401).send({
          error: { code: "invalid_refresh", message: "Refresh token rejected" },
        });
      }
    }
  );

  app.post(
    "/logout",
    { schema: { body: refreshBodySchema } },
    async (req) => {
      const body = req.body as { refreshToken: string };
      await logout(body.refreshToken);
      return { ok: true };
    }
  );
};