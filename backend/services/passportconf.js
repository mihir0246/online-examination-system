import passport from "passport";
import passportLocal from "passport-local";
const { Strategy: LocalStrategy } = passportLocal;
import bcrypt from 'bcryptjs';
import passportJwt from 'passport-jwt';
const { Strategy: JwtStrategy, ExtractJwt } = passportJwt;
import prisma from "./prisma.js";
import logger from "./logger.js";
import { isTokenBlacklisted } from "./redis.js";

// User Login Local Strategy
passport.use('login', new LocalStrategy({
  usernameField: 'emailid',
  passwordField: 'password',
  passReqToCallback: true
}, async (req, emailid, password, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { emailid, status: true }
    });

    if (!user) {
      return done(null, false, {
        success: false,
        message: "Invalid credentials"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      return done(null, user, {
        success: true,
        message: "Logged in successfully"
      });
    } else {
      return done(null, false, {
        success: false,
        message: "Invalid credentials"
      });
    }
  } catch (err) {
    logger.error(`Login error for ${emailid}: ${err.message}`);
    return done(err, false, {
      success: false,
      message: "Authentication error"
    });
  }
}));

// Combined extractor: Authorization header OR HttpOnly cookie
const cookieExtractor = (req) => {
  if (req && req.cookies) {
    return req.cookies['Token'] || null;
  }
  return null;
};

const tokenExtractors = [
  ExtractJwt.fromAuthHeaderAsBearerToken(),
  cookieExtractor
];

const opts = {
  jwtFromRequest: ExtractJwt.fromExtractors(tokenExtractors),
  secretOrKey: process.env.JWT_SECRET || "default-secret-change-me",
  // Plan 2.4: Pass req so we can extract the raw token for blacklist check
  passReqToCallback: true
};

// --- Plan 2.4: JWT Strategy with Redis blacklist enforcement ---
passport.use('user-token', new JwtStrategy(opts, async (req, jwt_payload, done) => {
  try {
    // Extract the raw token to check against blacklist
    const rawToken = ExtractJwt.fromExtractors(tokenExtractors)(req);
    if (rawToken) {
      const blacklisted = await isTokenBlacklisted(rawToken);
      if (blacklisted) {
        logger.warn(`Blocked blacklisted token for user ${jwt_payload.id}`);
        return done(null, false, { success: false, message: 'Session has been revoked. Please log in again.' });
      }
    }

    // Bug#9 Fix: Trainees are stored in a separate collection from Users.
    // Route the DB lookup by token type to avoid 401 on all exam routes.
    if (jwt_payload.type === 'TRAINEE') {
      const trainee = await prisma.trainee.findUnique({ where: { id: jwt_payload.id } });
      if (trainee) {
        return done(null, { ...trainee, type: 'TRAINEE' }, { success: true, message: 'Authorized' });
      }
      return done(null, false, { success: false, message: 'Trainee not found' });
    }

    // ADMIN / TRAINER — look up in the User collection
    const user = await prisma.user.findUnique({ where: { id: jwt_payload.id } });
    if (user) {
      return done(null, user, { success: true, message: 'Authorized' });
    }
    return done(null, false, { success: false, message: 'Unauthorized' });

  } catch (err) {
    logger.error(`JWT validation error: ${err.message}`);
    return done(err, false, { success: false, message: 'Session error' });
  }
}));

export default passport;