import { fileRepository } from "./file.repository";

export const fileService = {
  getFile: fileRepository.findById,
};
