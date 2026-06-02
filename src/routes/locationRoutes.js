const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const locationController = require('../controllers/locationController');

const router = express.Router();

router.get('/destinations', asyncHandler(locationController.searchDestinations));

module.exports = router;
