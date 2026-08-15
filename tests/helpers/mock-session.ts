// Installs a stub for `next-auth/next`'s getServerSession so API route handlers
// can be exercised without a real session/JWT. Must be imported BEFORE any
// module that transitively imports next-auth/next (e.g. route handlers).
//
// The stubbed session reads `sessionState.userId`, so each test can set the
// acting user (or clear it to simulate an unauthenticated request).

export const sessionState: { userId: string | null } = { userId: null };

const resolved = require.resolve("next-auth/next");
require.cache[resolved] = {
  id: resolved,
  filename: resolved,
  loaded: true,
  exports: {
    getServerSession: async () =>
      sessionState.userId ? { user: { id: sessionState.userId } } : null,
  },
} as unknown as NodeModule;
