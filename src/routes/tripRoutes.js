const express = require('express');
const tripController = require('../controllers/tripController');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const {
  idParam,
  createTripSchema,
  updateTripSchema,
  listTripsSchema
} = require('../validation/schemas');

const router = express.Router();

router.use(authenticate);

router
  .route('/')
  .post(validate(createTripSchema), asyncHandler(tripController.createTrip))
  .get(validate(listTripsSchema), asyncHandler(tripController.listTrips));

router
  .route('/:id')
  .get(validate(idParam), asyncHandler(tripController.getTrip))
  .put(validate(updateTripSchema), asyncHandler(tripController.updateTrip))
  .delete(validate(idParam), asyncHandler(tripController.deleteTrip));

module.exports = router;
