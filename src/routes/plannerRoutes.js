const express = require('express');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const plannerController = require('../controllers/plannerController');
const { idParam } = require('../validation/schemas');

const router = express.Router();

router.use(authenticate);

router.get('/trips/:id/summary', validate(idParam), asyncHandler(plannerController.getTripPlan));
router.get('/trips/:id/weather', validate(idParam), asyncHandler(plannerController.getTripPlan));

module.exports = router;
