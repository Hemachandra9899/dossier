import { NextRouter } from "next/router";
import { ParsedUrlQuery } from "querystring";
import { toast } from "sonner";

export const handleInvitationStatus = (
  invitationStatus: "accepted" | "teamMember",
  queryParams: ParsedUrlQuery,
  router: NextRouter,
) => {
  switch (invitationStatus) {
    case "accepted":
      toast.success("Welcome to the team! You've successfully joined.");
      break;
    case "teamMember":
      toast.error("You've already accepted this invitation!");
      break;
    default:
      toast.error("Invalid invitation status");
  }

  delete queryParams["invitation"];
  router.replace("/documents", undefined, {
    shallow: true,
  });
};
