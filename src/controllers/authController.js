const authService = require('../services/authService');

async function register(req, res) {
  const result = await authService.register(req.validated.body);

  res.status(201).json({
    success: true,
    data: result
  });
}

async function login(req, res) {
  const result = await authService.login(req.validated.body);

  res.status(200).json({
    success: true,
    data: result
  });
}

module.exports = {
  register,
  login
};
