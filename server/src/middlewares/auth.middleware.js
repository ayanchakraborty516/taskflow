import { verifyAccessToken, sanitizeUser } from '../utils/token.util.js';
import { UnauthorizedError } from '../utils/api-error.util.js';
import userRepository from '../repositories/user.repository.js';

/**
 * Extracts and verifies JWT credentials from HTTP-only cookie or Bearer header.
 * Validates that the referenced user exists and is active.
 */
export const authenticate = async (req, res, next) => {
  let token;

  // Check HTTP-only cookie first, then Bearer Authorization header
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new UnauthorizedError('Not authorized to access this resource. Please log in.'));
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await userRepository.findById(decoded.id);

    if (!user || !user.isActive) {
      return next(new UnauthorizedError('The user belonging to this token no longer exists or is inactive.'));
    }

    const sanitized = sanitizeUser(user);
    sanitized._id = sanitized.id;
    req.user = sanitized;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Session expired. Please log in again.'));
    }
    return next(new UnauthorizedError('Invalid or expired session. Please log in again.'));
  }
};

export const authMiddleware = authenticate;
export default authenticate;
