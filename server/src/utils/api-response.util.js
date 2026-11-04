/**
 * Recursively maps `id` to `_id` on objects and arrays
 * guaranteeing 100% backward compatibility with React client expectations.
 */
export const serializeData = (data) => {
  if (data === null || data === undefined) return data;
  if (data instanceof Date) return data.toISOString();

  if (Array.isArray(data)) {
    return data.map((item) => serializeData(item));
  }

  if (typeof data === 'object' && !(data instanceof RegExp)) {
    const serialized = {};
    for (const [key, value] of Object.entries(data)) {
      serialized[key] = serializeData(value);
    }
    if (serialized.id && !serialized._id) {
      serialized._id = serialized.id;
    }
    return serialized;
  }

  return data;
};

export class ApiResponse {
  constructor(statusCode, data = {}, message = 'Success') {
    this.statusCode = statusCode;
    this.success = statusCode >= 200 && statusCode < 400;
    this.message = message;
    this.data = serializeData(data);
  }

  send(res) {
    // If data is an object, merge properties at top-level to preserve legacy response envelopes
    // e.g. { success: true, message: '...', user: {...}, token: '...' }
    if (this.data && typeof this.data === 'object' && !Array.isArray(this.data)) {
      return res.status(this.statusCode).json({
        success: this.success,
        message: this.message,
        ...this.data,
      });
    }

    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      data: this.data,
    });
  }

  static success(res, data = {}, message = 'Success', statusCode = 200) {
    return new ApiResponse(statusCode, data, message).send(res);
  }

  static created(res, data = {}, message = 'Resource created successfully') {
    return new ApiResponse(201, data, message).send(res);
  }
}

export default ApiResponse;


