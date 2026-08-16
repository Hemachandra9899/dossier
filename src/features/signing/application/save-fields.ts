// SaveFields: persists the complete field layout for a native signing request.
//
// The authoring editor sends the full current layout; the server reconciles it
// in one transaction (upsert incoming, delete removed). Only editable request
// statuses (DRAFT/PREPARING/READY) may be changed; after SENT the layout is
// frozen and only recipients may fill values.

import type { SigningContext } from "./context";
import { SigningStateError } from "../domain/signing-errors";

const EDITABLE_STATUSES = new Set(["DRAFT", "PREPARING", "READY"]);

export interface SaveFieldsFieldInput {
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
}

export interface SaveFieldsInput {
  teamId: string;
  requestId: string;
  fields: SaveFieldsFieldInput[];
}

export interface SaveFieldsResult {
  count: number;
}

export async function saveFields(
  ctx: SigningContext,
  input: SaveFieldsInput,
): Promise<SaveFieldsResult> {
  const request = await ctx.requests.findByTeamAndIdWithRecipients(
    input.teamId,
    input.requestId,
  );

  if (!EDITABLE_STATUSES.has(request.status)) {
    throw new SigningStateError(
      `Field layout cannot be modified while the request is ${request.status}.`,
    );
  }

  const recipientIds = new Set(request.recipients.map((recipient) => recipient.id));

  for (const field of input.fields) {
    if (!recipientIds.has(field.recipientId)) {
      throw new SigningStateError(
        `Field references a recipient that does not belong to this request.`,
      );
    }
  }

  await ctx.fields.replaceLayout(input.requestId, input.fields);

  return { count: input.fields.length };
}
