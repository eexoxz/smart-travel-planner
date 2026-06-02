const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const locationController = require('../controllers/locationController');

const router = express.Router();

router.get('/destinations', asyncHandler(locationController.searchDestinations));
router.get('/states', asyncHandler(locationController.getStates));
router.get('/cities', asyncHandler(locationController.getCities));

module.exports = router;
