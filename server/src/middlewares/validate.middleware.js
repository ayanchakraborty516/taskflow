import { ZodError } from 'zod';

/**
 * Generic Zod request schema validation middleware.
 * Validates body, query, and params against the provided Zod schema.
 * Compatible with Express 5 request getters.
 */
export const validate = (schema) => async (req, res, next) => {
  try {
    if (schema.body) {
      req.body = await schema.body.parseAsync(req.body);
    }
    if (schema.query) {
      const parsedQuery = await schema.query.parseAsync(req.query);
      // Express 5 query has only a getter; use Object.assign to preserve property access
      Object.assign(req.query, parsedQuery);
      req.validatedQuery = parsedQuery;
    }
    if (schema.params) {
      const parsedParams = await schema.params.parseAsync(req.params);
      Object.assign(req.params, parsedParams);
      req.validatedParams = parsedParams;
    }
    next();
  } catch (error) {
    next(error);
  }
};

export default validate;
