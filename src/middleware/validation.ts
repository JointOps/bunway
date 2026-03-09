import type { Handler, NextFunction } from "../types";
import type { BunRequest } from "../core/request";
import type { BunResponse } from "../core/response";

// --- Validation Schema Types ---

export type ValidationSource = "body" | "query" | "params";

export interface FieldRule {
  /** Mark field as required. Default: false */
  required?: boolean;
  /** Field type: "string", "number", "boolean", "email", "url", "uuid", "integer" */
  type?: string;
  /** Minimum length (strings) or minimum value (numbers) */
  min?: number;
  /** Maximum length (strings) or maximum value (numbers) */
  max?: number;
  /** Regex pattern the value must match */
  pattern?: RegExp;
  /** Enumeration of allowed values */
  enum?: unknown[];
  /** Custom validator function. Return true if valid, false or string (error message) if invalid. */
  custom?: (value: unknown, req: BunRequest) => boolean | string | Promise<boolean | string>;
  /** Custom error message for this field */
  message?: string;
  /** Trim whitespace before validation (strings only). Default: false */
  trim?: boolean;
  /** Convert to lowercase before validation (strings only). Default: false */
  toLowerCase?: boolean;
  /** Convert to number before validation. Default: false */
  toNumber?: boolean;
}

export interface ValidationSchema {
  body?: Record<string, FieldRule>;
  query?: Record<string, FieldRule>;
  params?: Record<string, FieldRule>;
}

export interface ValidationError {
  field: string;
  source: ValidationSource;
  message: string;
  value?: unknown;
}

export interface ValidationOptions {
  /**
   * If true, abort on first error. If false, collect all errors.
   * Default: false (collect all)
   */
  abortEarly?: boolean;

  /**
   * HTTP status code for validation errors. Default: 422.
   */
  statusCode?: number;

  /**
   * Custom error formatter. Receives the array of errors and returns the response body.
   * Default: returns `{ errors: [...] }`
   */
  errorFormatter?: (errors: ValidationError[]) => unknown;

  /**
   * Custom error handler. If provided, called instead of sending automatic response.
   * Allows full control over error handling (e.g., pass to next(err)).
   */
  onError?: (errors: ValidationError[], req: BunRequest, res: BunResponse, next: NextFunction) => void;
}

// --- Built-in Validators ---

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URL_REGEX = /^https?:\/\/.+/;

function validateType(value: unknown, type: string): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && !isNaN(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "email":
      return typeof value === "string" && EMAIL_REGEX.test(value);
    case "url":
      return typeof value === "string" && URL_REGEX.test(value);
    case "uuid":
      return typeof value === "string" && UUID_REGEX.test(value);
    default:
      return true;
  }
}

// --- Core Validation Function ---

async function validateField(
  field: string,
  rawValue: unknown,
  rule: FieldRule,
  source: ValidationSource,
  req: BunRequest
): Promise<ValidationError | null> {
  const customMsg = rule.message;
  let value: unknown = rawValue;

  // Apply sanitizers
  if (typeof value === "string") {
    if (rule.trim) value = value.trim();
    if (rule.toLowerCase) value = (value as string).toLowerCase();
  }
  if (rule.toNumber && typeof value === "string") {
    const num = Number(value);
    if (!isNaN(num)) value = num;
  }

  // Required check
  if (rule.required) {
    if (value === undefined || value === null || value === "") {
      return { field, source, message: customMsg ?? `${field} is required`, value };
    }
  }

  // Skip remaining validations if value is not present and not required
  if (value === undefined || value === null || value === "") return null;

  // Type check
  if (rule.type && !validateType(value, rule.type)) {
    return { field, source, message: customMsg ?? `${field} must be of type ${rule.type}`, value };
  }

  // Min/Max for strings (length) and numbers (value)
  if (rule.min !== undefined) {
    if (typeof value === "string" && value.length < rule.min) {
      return { field, source, message: customMsg ?? `${field} must be at least ${rule.min} characters`, value };
    }
    if (typeof value === "number" && value < rule.min) {
      return { field, source, message: customMsg ?? `${field} must be at least ${rule.min}`, value };
    }
  }

  if (rule.max !== undefined) {
    if (typeof value === "string" && value.length > rule.max) {
      return { field, source, message: customMsg ?? `${field} must be at most ${rule.max} characters`, value };
    }
    if (typeof value === "number" && value > rule.max) {
      return { field, source, message: customMsg ?? `${field} must be at most ${rule.max}`, value };
    }
  }

  // Pattern check
  if (rule.pattern && typeof value === "string" && !rule.pattern.test(value)) {
    return { field, source, message: customMsg ?? `${field} does not match the required pattern`, value };
  }

  // Enum check
  if (rule.enum && !rule.enum.includes(value)) {
    return { field, source, message: customMsg ?? `${field} must be one of: ${rule.enum.join(", ")}`, value };
  }

  // Custom validator
  if (rule.custom) {
    const result = await rule.custom(value, req);
    if (result === false) {
      return { field, source, message: customMsg ?? `${field} is invalid`, value };
    }
    if (typeof result === "string") {
      return { field, source, message: result, value };
    }
  }

  return null;
}

function getSourceData(req: BunRequest, source: ValidationSource): Record<string, unknown> {
  switch (source) {
    case "body":
      return (req.body as Record<string, unknown>) ?? {};
    case "query": {
      const obj: Record<string, unknown> = {};
      for (const [key, value] of req.query.entries()) {
        obj[key] = value;
      }
      return obj;
    }
    case "params":
      return req.params ?? {};
  }
}

// --- Middleware Factory ---

export function validate(schema: ValidationSchema, options: ValidationOptions = {}): Handler {
  const statusCode = options.statusCode ?? 422;
  const abortEarly = options.abortEarly ?? false;
  const errorFormatter = options.errorFormatter ?? ((errors: ValidationError[]) => ({ errors }));

  return async (req: BunRequest, res: BunResponse, next: NextFunction) => {
    const errors: ValidationError[] = [];

    const sources: ValidationSource[] = ["params", "query", "body"];

    for (const source of sources) {
      const rules = schema[source];
      if (!rules) continue;

      const data = getSourceData(req, source);

      for (const [field, rule] of Object.entries(rules)) {
        const value = data[field];
        const error = await validateField(field, value, rule, source, req);

        if (error) {
          errors.push(error);
          if (abortEarly) break;
        }
      }

      if (abortEarly && errors.length > 0) break;
    }

    if (errors.length > 0) {
      if (options.onError) {
        options.onError(errors, req, res, next);
        return;
      }

      res.status(statusCode).json(errorFormatter(errors));
      return;
    }

    next();
  };
}
