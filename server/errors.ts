export type Status = 400 | 401 | 403 | 404 | 409 | 410 | 429 | 500 | 503;

/** An error the client is meant to see. Text is plain, sentence case, no exclamation marks. */
export class ApiErr extends Error {
  constructor(public status: Status, public code: string, message: string) {
    super(message);
  }
}

export const bad = (code: string, message: string) => new ApiErr(400, code, message);
