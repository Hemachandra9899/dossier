import { publicAccessRepository } from "./public-access.repository";

export const sharingService = {
  createFileShare: publicAccessRepository.createFileShare,
  getPublicFileAccess: publicAccessRepository.getPublicFileAccess,
};
