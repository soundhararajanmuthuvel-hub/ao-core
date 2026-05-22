const errorHandler = (err, req, res, next) => {
  console.error(err);

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Server Error';

  if (err.code === 11000) {
    statusCode = 400;
    message = 'Duplicate field value';
  }

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((item) => item.message)
      .join(', ');
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}`;
  }

  if (err.name === 'MulterError') {
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
