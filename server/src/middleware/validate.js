export function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.query) req.query = schemas.query.parse(req.query ?? {});
      if (schemas.params) req.params = schemas.params.parse(req.params ?? {});
      next();
    } catch (error) {
      const message = error.issues?.map((issue) => issue.message).join('; ') || 'Invalid request';
      const wrapped = new Error(message);
      wrapped.status = 400;
      wrapped.code = 'validation_error';
      next(wrapped);
    }
  };
}
