import { NextResponse } from "next/server";

export async function requireFileAccess(_arg1?: any, _arg2?: any, _arg3?: any) {
  const fileId = typeof _arg1 === "string" ? _arg1 : typeof _arg2 === "string" ? _arg2 : "file-123";
  return {
    userId: "user-123",
    teamId: "team-123",
    file: { id: fileId, teamId: "team-123", requirementsTaskListId: "list-123" },
  };
}

export const requireFileManageAccess = requireFileAccess;

export async function requireTeamMembership(_arg1?: any, _arg2?: any, _arg3?: any) {
  const teamId = typeof _arg1 === "string" ? _arg1 : typeof _arg2 === "string" ? _arg2 : "team-123";
  return {
    userId: "user-123",
    teamId,
    membership: { role: "ADMIN", teamId },
  };
}

export function sendAuthorizationError(_arg1?: any, _arg2?: any, _arg3?: any) {
  const res = _arg2 && typeof _arg2.status === "function" ? _arg2 : _arg1 && typeof _arg1.status === "function" ? _arg1 : null;
  const error = _arg3 || _arg2 || _arg1;
  if (res && typeof res.status === "function") {
    return res.status(403).json({ error: error?.message || "Forbidden" });
  }
  return NextResponse.json({ error: error?.message || "Forbidden" }, { status: 403 });
}
