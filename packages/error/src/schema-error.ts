import type { ZodError } from 'zod'

import type { ErrorCode } from './error-code'
import { BaseError } from './base-error'
import { parseZodErrorIssues } from './utils'

interface Context {
  raw: unknown;
  [key: string]: unknown;
}

export class SchemaError extends BaseError<Context> {
  public readonly name = 'SchemaError'
  public readonly code: ErrorCode

  constructor(opts: {
    code: ErrorCode
    message: string
    cause?: BaseError
    context?: Context
  }) {
    super(opts)
    this.code = opts.code
  }

  static fromZod<T>(e: ZodError<T>, raw: unknown): SchemaError {
    return new SchemaError({
      code: 'UNPROCESSABLE_ENTITY',
      message: parseZodErrorIssues(e.issues),
      context: { raw: JSON.stringify(raw) },
    })
  }
}
