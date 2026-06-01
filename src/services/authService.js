const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/appError');

function signToken(user) {
  return jwt.sign(
    {
      email: user.email,
      role: user.role
    },
    env.jwtSecret,
    {
      subject: String(user.id),
      expiresIn: env.jwtExpiresIn
    }
  );
}

async function register({ name, email, password }) {
  const existingUser = userRepository.findByEmail(email);

  if (existingUser) {
    throw new AppError('Email is already registered', 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = userRepository.create({ name, email, passwordHash });

  return {
    user: userRepository.toPublicUser(user),
    token: signToken(user)
  };
}

async function login({ email, password }) {
  const user = userRepository.findByEmail(email);

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    throw new AppError('Invalid email or password', 401);
  }

  return {
    user: userRepository.toPublicUser(user),
    token: signToken(user)
  };
}

module.exports = {
  register,
  login
};
