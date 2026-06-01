const express = require('express');
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { registerSchema, loginSchema } = require('../validation/schemas');

const router = express.Router();

router.post('/register', validate(registerSchema), asyncHandler(authController.register));
router.post('/login', validate(loginSchema), asyncHandler(authController.login));

module.exports = router;
