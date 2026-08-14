export interface AddRequirementInput {
  fileId: string;
  title: string;
  type: "TODO" | "UPLOAD" | "ACKNOWLEDGE";
  description?: string;
  assigneeEmail?: string;
}

export interface UpdateRequirementInput {
  status?: "OPEN" | "SUBMITTED" | "COMPLETED" | "REJECTED";
  comment?: string;
}
