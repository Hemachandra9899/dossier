// Centralized TanStack Query key factory for the signing feature. Every query
// and mutation in the feature derives its key from here so invalidation and
// cache sharing stay consistent. Never put tokens, emails or other secrets in
// a key.

export const signingKeys = {
  all: ["signing"] as const,

  requests: {
    all: () => [...signingKeys.all, "requests"] as const,
    detail: (teamId: string, requestId: string) =>
      [...signingKeys.requests.all(), "detail", teamId, requestId] as const,
    activeForDocument: (teamId: string, documentId: string) =>
      [...signingKeys.requests.all(), "active-for-document", teamId, documentId] as const,
    artifact: (teamId: string, requestId: string) =>
      [...signingKeys.requests.all(), "artifact", teamId, requestId] as const,
  },

  templates: {
    all: () => [...signingKeys.all, "templates"] as const,
    editorSession: (teamId: string, templateId: string) =>
      [...signingKeys.templates.all(), "editor-session", teamId, templateId] as const,
  },

  public: {
    all: () => [...signingKeys.all, "public"] as const,
    request: (requestId: string) =>
      [...signingKeys.public.all(), "request", requestId] as const,
    artifact: (requestId: string) =>
      [...signingKeys.public.all(), "artifact", requestId] as const,
  },
} as const;
