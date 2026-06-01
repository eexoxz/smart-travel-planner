const AppError = require('../utils/appError');

function notFoundHandler(req, res, next) {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    error: {
      message: statusCode === 500 && isProduction ? 'Internal server error' : err.message,
      details: err.details
    }
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
