// TanStack Query mutations for the Files board.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { filesApi } from "./files.api";
import { fileKeys } from "./files.keys";
import { CreateFileSchema, MoveFileSchema } from "../file.schema";
import { z } from "zod";
import type { FileBoardItem, MoveFileInput } from "../file.types";

export function useCreateFile(
  teamId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      (input: z.infer<typeof CreateFileSchema>) =>
        filesApi.create(teamId, input),

    onSuccess: ({ file }) => {
      queryClient.setQueryData<{
        files: FileBoardItem[];
      }>(
        fileKeys.board(teamId),
        (current) => ({
          files: [file, ...(current?.files ?? [])],
        }),
      );
    },
  });
}

export function useMoveFile(
  teamId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn:
      (input: MoveFileInput & { fileId: string }) =>
        filesApi.move(teamId, input.fileId, input),

    onMutate: async (input) => {
      const key = fileKeys.board(teamId);

      await queryClient.cancelQueries({
        queryKey: key,
      });

      const previous = queryClient.getQueryData<{
        files: FileBoardItem[];
      }>(key);

      queryClient.setQueryData(
        key,
        (current: typeof previous) => {
          if (!current) return current;

          return {
            files: current.files.map((file) =>
              file.id === input.fileId
                ? { ...file, status: input.status }
                : file,
            ),
          };
        },
      );

      return { previous };
    },

    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(fileKeys.board(teamId), context.previous);
      }
    },

    onSuccess: ({ file }) => {
      queryClient.setQueryData<{
        files: FileBoardItem[];
      }>(
        fileKeys.board(teamId),
        (current) => {
          if (!current) {
            return { files: [file] };
          }

          return {
            files: current.files.map((item) =>
              item.id === file.id ? file : item,
            ),
          };
        },
      );
    },
  });
}

export function useInvalidateFileState(
  teamId: string,
  fileId: string,
) {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: fileKeys.board(teamId),
      }),

      queryClient.invalidateQueries({
        queryKey: fileKeys.detail(teamId, fileId),
      }),
    ]);
  };
}