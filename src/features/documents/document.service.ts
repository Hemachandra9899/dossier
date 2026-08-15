import {
  createDocument,
  createAgreementDocument,
  createNewDocumentVersion,
} from "@/shared/utils/documents/create-document";
import { documentRepository } from "./document.repository";
import type { DocumentData } from "./document.types";

export const documentService = {
  createDocument,
  createAgreementDocument,
  createNewDocumentVersion,
  getDocument: documentRepository.findById,
  deleteDocument: documentRepository.deleteById,
};

export { createDocument, createAgreementDocument, createNewDocumentVersion };
