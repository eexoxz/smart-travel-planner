const AppError = require('../utils/appError');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }));

      return next(new AppError('Request validation failed', 400, details));
    }

    req.validated = result.data;
    return next();
  };
}

module.exports = validate;
