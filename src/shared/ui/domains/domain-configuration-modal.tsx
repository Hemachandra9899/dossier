import React from "react";
import { AddDomainModal } from "./add-domain-modal";
import { LinkType } from "@/shared/utils/types";

export function DomainConfigurationModal({
  isOpen,
  setIsOpen,
  linkType,
}: {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  linkType?: Omit<LinkType, "WORKFLOW_LINK">;
}) {
  return (
    <AddDomainModal
      open={isOpen}
      setOpen={setIsOpen}
      linkType={linkType}
    />
  );
}

export default DomainConfigurationModal;
