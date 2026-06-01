const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/appError');

function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Authentication token is required', 401));
  }

  try {
    const token = header.replace(/^Bearer\s+/i, '').replace(/^Bearer\s+/i, '').trim();
    const payload = jwt.verify(token, env.jwtSecret);
    const user = userRepository.findById(payload.sub);

    if (!user) {
      return next(new AppError('Authenticated user no longer exists', 401));
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    return next();
  } catch (error) {
    return next(new AppError('Invalid or expired authentication token', 401));
  }
}

module.exports = authenticate;
