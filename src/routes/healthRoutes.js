const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      service: 'Smart Travel Planner API',
      status: 'healthy',
      version: '1.0.0'
    }
  });
});

module.exports = router;
