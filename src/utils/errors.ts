/** Message of anything that was thrown (catch variables are `unknown`). */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
