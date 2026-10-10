import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { User, toSafeUser } from '../models/User.js';
import { generateToken, generateCsrfToken } from '../utils/token.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'strict' : 'lax') as 'strict' | 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };
};

const getCsrfCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: false, // Available to client script to attach in X-CSRF-Token header
    secure: isProd,
    sameSite: (isProd ? 'strict' : 'lax') as 'strict' | 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
};

/**
 * POST /api/auth/register
 * Public registration endpoint. Always assigns 'patient' role.
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    // Reject attempts to assign privileged roles during public registration
    if (role && role !== 'patient') {
      res.status(400).json({
        status: 'error',
        message: 'Privileged roles cannot be assigned during public registration.',
      });
      return;
    }

    // Input validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({
        status: 'error',
        message: 'Full name is required and must be at least 2 characters long.',
      });
      return;
    }

    if (name.trim().length > 100) {
      res.status(400).json({
        status: 'error',
        message: 'Full name cannot exceed 100 characters.',
      });
      return;
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      res.status(400).json({
        status: 'error',
        message: 'A valid email address is required.',
      });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({
        status: 'error',
        message: 'Password must be at least 8 characters long.',
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing user with normalized email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      res.status(409).json({
        status: 'error',
        message: 'An account with this email address already exists.',
      });
      return;
    }

    // Hash password with bcrypt cost factor 12
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'patient',
      isActive: true,
      allergies: [],
      chronicConditions: [],
      notificationPreferences: {
        medicationReminders: true,
        appointmentAlerts: true,
        healthTips: false,
        emailUpdates: true,
      },
      bookmarkedConditions: [],
      bookmarkedMedicines: [],
      bookmarkedArticles: [],
    });

    await user.save();

    // Generate tokens & set secure cookies
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });
    const csrfToken = generateCsrfToken();

    res.cookie('careconnect_token', token, getCookieOptions());
    res.cookie('careconnect_csrf_token', csrfToken, getCsrfCookieOptions());

    res.status(201).json({
      status: 'success',
      message: 'Account registered successfully.',
      user: toSafeUser(user),
      csrfToken,
    });
  } catch (error: any) {
    // Handle duplicate key error safely
    if (error.code === 11000) {
      res.status(409).json({
        status: 'error',
        message: 'An account with this email address already exists.',
      });
      return;
    }
    next(error);
  }
};

/**
 * POST /api/auth/login
 * User login endpoint with credential verification and session cookie setting.
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({
        status: 'error',
        message: 'Email and password are required.',
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Query user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.passwordHash) {
      // Generic error message to prevent account enumeration
      res.status(401).json({
        status: 'error',
        message: 'Invalid email or password.',
      });
      return;
    }

    // Check account status
    if (!user.isActive) {
      res.status(403).json({
        status: 'error',
        message: 'This account has been deactivated. Please contact support.',
      });
      return;
    }

    // Verify password hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid email or password.',
      });
      return;
    }

    // Generate tokens & set secure cookies
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });
    const csrfToken = generateCsrfToken();

    res.cookie('careconnect_token', token, getCookieOptions());
    res.cookie('careconnect_csrf_token', csrfToken, getCsrfCookieOptions());

    res.status(200).json({
      status: 'success',
      message: 'Signed in successfully.',
      user: toSafeUser(user),
      csrfToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Invalidate session by clearing cookies.
 */
export const logout = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('careconnect_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/',
  });
  res.clearCookie('careconnect_csrf_token', {
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/',
  });

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully.',
  });
};

/**
 * GET /api/auth/me
 * Returns current authenticated user and CSRF token.
 */
export const me = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      status: 'error',
      message: 'Not authenticated.',
    });
    return;
  }

  const csrfToken = req.cookies?.careconnect_csrf_token || generateCsrfToken();
  if (!req.cookies?.careconnect_csrf_token) {
    res.cookie('careconnect_csrf_token', csrfToken, getCsrfCookieOptions());
  }

  res.status(200).json({
    status: 'success',
    user: toSafeUser(req.user),
    csrfToken,
  });
};
