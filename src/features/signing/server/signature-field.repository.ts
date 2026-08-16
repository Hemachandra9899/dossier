import { Prisma } from "@prisma/client";
import prisma from "@/platform/db";
import { SigningNotFoundError } from "../domain/signing-errors";

export type SignatureFieldInput = {
  id?: string;
  recipientId: string;
  type: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required?: boolean;
  label?: string | null;
  placeholder?: string | null;
  options?: unknown;
};

export type SignatureFieldWithRequest = Awaited<
  ReturnType<SignatureFieldRepository["listByRequestId"]>
>[number];

export class SignatureFieldRepository {
  async listByRequestId(requestId: string) {
    return prisma.signatureField.findMany({
      where: { signatureRequestId: requestId },
      orderBy: [{ pageNumber: "asc" }, { y: "asc" }, { x: "asc" }],
    });
  }

  async listByRequestAndRecipient(requestId: string, recipientId: string) {
    return prisma.signatureField.findMany({
      where: { signatureRequestId: requestId, recipientId },
      orderBy: [{ pageNumber: "asc" }, { y: "asc" }, { x: "asc" }],
    });
  }

  /**
   * Replaces the request's field layout in one transaction: incoming fields
   * are upserted (by client-provided id) and fields that disappeared from the
   * layout are deleted. Only safe for editable requests (DRAFT/PREPARING/READY);
   * the caller enforces request status.
   */
  async replaceLayout(requestId: string, fields: SignatureFieldInput[]) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.signatureField.findMany({
        where: { signatureRequestId: requestId },
        select: { id: true },
      });

      const incomingIds = new Set(fields.map((field) => field.id).filter(Boolean) as string[]);

      const deleteIds = existing
        .map((row) => row.id)
        .filter((id) => !incomingIds.has(id));

      if (deleteIds.length > 0) {
        await tx.signatureField.deleteMany({
          where: { id: { in: deleteIds } },
        });
      }

      for (const field of fields) {
        const data: Prisma.SignatureFieldUncheckedCreateInput = {
          signatureRequestId: requestId,
          recipientId: field.recipientId,
          type: field.type as never,
          pageNumber: field.pageNumber,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          required: field.required ?? true,
          label: field.label ?? null,
          placeholder: field.placeholder ?? null,
          options: (field.options as Prisma.InputJsonValue | null) ?? undefined,
        };

        if (field.id) {
          await tx.signatureField.upsert({
            where: { id: field.id },
            create: { id: field.id, ...data },
            update: data,
          });
        } else {
          await tx.signatureField.create({ data });
        }
      }
    });
  }

  async deleteByRequestId(requestId: string) {
    await prisma.signatureField.deleteMany({ where: { signatureRequestId: requestId } });
  }

  async findById(id: string) {
    const field = await prisma.signatureField.findUnique({ where: { id } });
    if (!field) {
      throw new SigningNotFoundError(`Signature field ${id} not found`);
    }
    return field;
  }

  /**
   * Saves a recipient's response on a single field (text value or a drawn /
   * uploaded signature image). Sets `completedAt` when the response counts as
   * complete per the field domain. Only valid for SENT/VIEWED/SIGNING/
   * PARTIALLY_SIGNED requests — the caller enforces request status. Returns
   * the updated field.
   */
  async updateResponse(input: {
    fieldId: string;
    value?: unknown;
    signatureStorageKey?: string | null;
    completedAt?: Date | null;
  }) {
    const data: Prisma.SignatureFieldUpdateInput = {};
    if (input.value !== undefined) {
      data.value = input.value as Prisma.InputJsonValue;
    }
    if (input.signatureStorageKey !== undefined) {
      data.signatureStorageKey = input.signatureStorageKey;
    }
    if (input.completedAt !== undefined) {
      data.completedAt = input.completedAt;
    }
    return prisma.signatureField.update({
      where: { id: input.fieldId },
      data,
    });
  }
}
