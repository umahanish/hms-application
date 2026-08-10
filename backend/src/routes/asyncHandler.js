/**
 * Express 4 does not forward rejected promises from async route handlers to the
 * error middleware on its own -- wrap every async handler with this so unexpected
 * DB/service errors reach the central error handler instead of hanging the request.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
