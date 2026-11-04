import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import env from '../config/env.config.js';

const BCRYPT_SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = env.JWT_EXPIRES_IN || '7d';
const REFRESH_TOKEN_DAYS = 30;

/**
 * Hashes a plaintext password using bcrypt.
 */
export const hashPassword = async (password) => {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

/**
 * Compares plaintext password against a stored bcrypt hash.
 */
export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * Hashes a raw token string using SHA-256 for secure database storage.
 */
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generates a signed JWT access token.
 */
export const generateAccessToken = (user) => {
  const payload = {
    id: user.id || user._id,
    email: user.email,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
};

/**
 * Generates an opaque random refresh token along with its SHA-256 hash and expiration date.
 */
export const generateRefreshToken = () => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  return {
    rawToken,
    hashedToken,
    expiresAt,
  };
};

/**
 * Verifies a JWT access token.
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

/**
 * Attaches HTTP-only authentication cookies to the HTTP response.
 */
export const setAuthCookies = (res, accessToken, rawRefreshToken = null) => {
  const isProduction = env.NODE_ENV === 'production';
  const sameSite = env.COOKIE_SAMESITE || (isProduction ? 'strict' : 'lax');

  // Primary JWT access cookie
  res.cookie('token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });

  // Long-lived refresh token cookie if available
  if (rawRefreshToken) {
    res.cookie('refreshToken', rawRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });
  }
};

/**
 * Clears authentication cookies from the HTTP response.
 */
export const clearAuthCookies = (res) => {
  const isProduction = env.NODE_ENV === 'production';
  const sameSite = env.COOKIE_SAMESITE || (isProduction ? 'strict' : 'lax');

  res.cookie('token', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    expires: new Date(0),
    path: '/',
  });

  res.cookie('refreshToken', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    expires: new Date(0),
    path: '/api/auth',
  });
};

/**
 * Strips sensitive fields (like password) from user objects before serialization.
 */
export const sanitizeUser = (user) => {
  if (!user) return null;
  const sanitized = { ...user };
  delete sanitized.password;
  return sanitized;
};

export default {
  hashPassword,
  comparePassword,
  hashToken,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  setAuthCookies,
  clearAuthCookies,
  sanitizeUser,
};

