import prisma from "./prisma.js";
import passport from "./passportconf.js";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import logger from "./logger.js";
import { auditLog, AuditEvent } from "./auditLog.js";

const loginSchema = z.object({
  emailid: z.string().email("Invalid email format"),
  password: z.string().min(5, "Password must be at least 5 characters")
});

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  emailid: z.string().email("Invalid email format"),
  password: z.string().min(5, "Password must be at least 5 characters"),
  contact: z.string().length(10, "Contact must be 10 digits")
});

export const userlogin = (req, res, next) => {
  const validation = loginSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: validation.error.issues.map(e => e.message).join(", ")
    });
  }

  passport.authenticate('login', { session: false }, (err, user, info) => {
    if (err) {
      logger.error(`Login error: ${err.message}`);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
    
    if (!user) {
      // Plan 3.1: Audit failed login
      const emailid = req.body?.emailid || 'unknown';
      auditLog({ event: AuditEvent.USER_LOGIN, metadata: { success: false, emailid }, ip: req.ip });
      return res.status(401).json(info);
    }

    const token = jwt.sign(
      { id: user.id, email: user.emailid, type: user.type }, 
      process.env.JWT_SECRET || "default-secret-change-me", 
      { expiresIn: '24h' }
    );

    // Secure HttpOnly cookie
    res.cookie('Token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Plan 3.1: Audit successful login
    auditLog({ event: AuditEvent.USER_LOGIN, userId: user.id, metadata: { success: true, type: user.type }, ip: req.ip });

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        type: user.type,
        emailid: user.emailid
      },
      token: token
    });
  })(req, res, next);
};

export const userSignup = async (req, res) => {
  const validation = signupSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: validation.error.issues.map(e => e.message).join(", ")
    });
  }

  try {
    const { name, emailid, password, contact } = validation.data;
    const existing = await prisma.user.findUnique({ where: { emailid } });
    
    if (existing) {
      return res.status(409).json({ success: false, message: "This email already exists!" });
    }

    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        name,
        emailid,
        password: hash,
        contact,
        type: 'TRAINER'
      }
    });

    return res.json({
      success: true,
      message: "Trainer account created successfully! Please login."
    });
  } catch (err) {
    logger.error(`Signup error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Server Error during signup" });
  }
};

export const userlogout = async (req, res) => {
  // Hoist token extraction above try — so it's in scope for audit + cookie clear
  const token = req.cookies?.['Token'] ||
    req.headers?.authorization?.replace('Bearer ', '');

  try {
    if (token) {
      let ttl = 24 * 60 * 60; // fallback: 24h
      try {
        const decoded = jwt.decode(token);
        if (decoded?.exp) {
          const remaining = decoded.exp - Math.floor(Date.now() / 1000);
          if (remaining > 0) ttl = remaining;
        }
      } catch (_) { /* use fallback TTL */ }
      const { blacklistToken } = await import('./redis.js');
      await blacklistToken(token, ttl);
    }
  } catch (err) {
    logger.error(`Logout blacklist error: ${err.message}`);
    // Security: a failed blacklist means the token remains valid.
    // Return 500 so the client knows logout did not fully succeed and can retry.
    return res.status(500).json({
      success: false,
      message: 'Logout failed: session revocation unsuccessful. Please try again.'
    });
  }


  if (token) {
    auditLog({ event: AuditEvent.USER_LOGOUT, ip: req.ip, metadata: { tokenRevoked: !!token } });
  }

  res.clearCookie('Token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/'
  });
  res.json({ success: true, message: "Logout successful" });
};

