export function notFound(_req, _res, next) {
  const error = new Error('Not found');
  error.status = 404;
  error.code = 'not_found';
  next(error);
}
