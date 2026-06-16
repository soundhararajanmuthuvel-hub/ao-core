const errorHandler = (err, req, res, next) => {
  console.error(err);

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Server Error';

  // Handle Sequelize Unique Constraint Error (e.g. duplicate email or SKU)
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    message = err.errors && err.errors.length
      ? err.errors.map((e) => `${e.path} must be unique`).join(', ')
      : 'Duplicate field value';
  }

  // Handle Sequelize Validation Error
  else if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = err.errors && err.errors.length
      ? err.errors.map((e) => e.message).join(', ')
      : 'Validation error';
  }

  // Handle legacy/other errors (like Multer upload issues)
  else if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
