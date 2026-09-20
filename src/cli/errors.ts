/** A problem the user can fix (wrong option, missing file, busy database). Exit code 2. */
export class CliError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CliError';
  }
}
