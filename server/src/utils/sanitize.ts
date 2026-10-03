/**
 * CareConnect Backend Utilities - Sanitization
 * Safely masks database credentials and sensitive connection strings from logs and error messages.
 */

const MONGO_URI_REGEX = /(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@.+)/gi;

/**
 * Masks credentials in a MongoDB connection string.
 * Example: mongodb+srv://user:pass@cluster.mongodb.net -> mongodb+srv://user:*****@cluster.mongodb.net
 */
export function sanitizeUri(uri?: string): string {
  if (!uri) return '';
  return uri.replace(MONGO_URI_REGEX, '$1*****$3');
}

/**
 * Extracts a safe error message without exposing connection strings, passwords, or credentials.
 */
export function sanitizeError(error: unknown): string {
  if (!error) return 'Unknown error';

  let message = '';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
  }

  // Strip any embedded MongoDB URI credentials
  return message.replace(MONGO_URI_REGEX, '$1*****$3');
}
