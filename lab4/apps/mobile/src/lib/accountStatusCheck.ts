/** One in-flight check per session; disposal ignores results from old sessions. */
export function createAccountStatusCheck(
  isActive: () => Promise<boolean>,
  onSuspended: () => Promise<void>,
) {
  let disposed = false;
  let checking = false;
  return {
    async check() {
      if (disposed || checking) return;
      checking = true;
      try {
        if (!(await isActive()) && !disposed) await onSuspended();
      } catch {
        // Offline or failed requests do not establish suspension. Retry later.
      } finally {
        checking = false;
      }
    },
    dispose() {
      disposed = true;
    },
  };
}
