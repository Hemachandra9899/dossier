import { toast } from "sonner";

export function copyToClipboard(text: string, message: string): void {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      toast.success(message);
    })
    .catch((error) => {
      toast.warning("Please copy your link manually.");
    });
}
