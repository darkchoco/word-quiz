/** Runs `fn` and returns what it threw. Fails the test if nothing was thrown. */
export function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the function to throw');
}
