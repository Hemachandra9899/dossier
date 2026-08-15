// Client-side wizard state. Temporary state lives here (React context +
// reducer); nothing is persisted server-side until the final request creation.

import { createContext, useContext, useMemo, useReducer } from "react";

import type { SignatureRequestStatus } from "@/features/signing/domain/signature-request";

import type {
  EditorSessionDraft,
  RecipientDraft,
  RequestSignatureDraft,
  RequestSignatureStep,
} from "./types";

export interface RequestSignatureState {
  step: RequestSignatureStep;
  draft: RequestSignatureDraft;
  editorSession: EditorSessionDraft | null;
  isCreatingTemplate: boolean;
  isCreatingRequest: boolean;
  result: { requestId: string; status: SignatureRequestStatus } | null;
  error: string | null;
}

type RequestSignatureAction =
  | { type: "GO_TO_STEP"; step: RequestSignatureStep }
  | { type: "SET_RECIPIENTS"; recipients: RecipientDraft[] }
  | { type: "SET_TEMPLATE"; templateId: string }
  | { type: "SET_EDITOR_SESSION"; session: EditorSessionDraft }
  | { type: "SET_EDITOR_READY"; ready: boolean }
  | { type: "SET_EXPIRATION"; expiresAt: string | null }
  | { type: "CREATING_TEMPLATE"; value: boolean }
  | { type: "CREATING_REQUEST"; value: boolean }
  | { type: "SET_RESULT"; requestId: string; status: SignatureRequestStatus }
  | { type: "SET_ERROR"; message: string | null }
  | { type: "RESET"; documentId: string; documentName: string };

const initialState = (documentId: string, documentName: string): RequestSignatureState => ({
  step: "RECIPIENTS",
  draft: {
    documentId,
    documentName,
    recipients: [{ name: "", email: "", signingOrder: 1 }],
    templateId: null,
    editorReady: false,
    expiresAt: null,
  },
  editorSession: null,
  isCreatingTemplate: false,
  isCreatingRequest: false,
  result: null,
  error: null,
});

function reducer(
  state: RequestSignatureState,
  action: RequestSignatureAction,
): RequestSignatureState {
  switch (action.type) {
    case "GO_TO_STEP":
      return { ...state, step: action.step, error: null };
    case "SET_RECIPIENTS":
      return { ...state, draft: { ...state.draft, recipients: action.recipients } };
    case "SET_TEMPLATE":
      return {
        ...state,
        draft: { ...state.draft, templateId: action.templateId },
      };
    case "SET_EDITOR_SESSION":
      return { ...state, editorSession: action.session };
    case "SET_EDITOR_READY":
      return { ...state, draft: { ...state.draft, editorReady: action.ready } };
    case "SET_EXPIRATION":
      return { ...state, draft: { ...state.draft, expiresAt: action.expiresAt } };
    case "CREATING_TEMPLATE":
      return { ...state, isCreatingTemplate: action.value };
    case "CREATING_REQUEST":
      return { ...state, isCreatingRequest: action.value };
    case "SET_RESULT":
      return { ...state, result: { requestId: action.requestId, status: action.status } };
    case "SET_ERROR":
      return { ...state, error: action.message };
    case "RESET":
      return initialState(action.documentId, action.documentName);
    default:
      return state;
  }
}

interface RequestSignatureContextValue {
  state: RequestSignatureState;
  dispatch: React.Dispatch<RequestSignatureAction>;
}

const RequestSignatureContext = createContext<RequestSignatureContextValue | null>(
  null,
);

export function RequestSignatureProvider({
  documentId,
  documentName,
  children,
}: {
  documentId: string;
  documentName: string;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => initialState(documentId, documentName),
  );

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <RequestSignatureContext.Provider value={value}>
      {children}
    </RequestSignatureContext.Provider>
  );
}

export function useRequestSignature() {
  const context = useContext(RequestSignatureContext);
  if (!context) {
    throw new Error(
      "useRequestSignature must be used within a RequestSignatureProvider",
    );
  }
  return context;
}
