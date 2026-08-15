import React from "react";
import { FileCode, FileIcon, Link as LinkIcon, MailIcon } from "lucide-react";

export function fileIcon({
  fileType,
  className = "mx-auto h-6 w-6",
  isLight = true,
}: {
  fileType: string;
  className?: string;
  isLight?: boolean;
}) {
  switch (fileType) {
    case "link":
      return <LinkIcon className={className} />;
    case "application/vnd.ms-outlook":
    case "email":
      return <MailIcon className={className} />;
    case "text/html":
    case "html":
      return <FileCode className={className} />;
    default:
      return <FileIcon className={className} />;
  }
}
