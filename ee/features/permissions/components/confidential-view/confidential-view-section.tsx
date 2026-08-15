import { useEffect, useState } from "react";
import LinkItem from "@/shared/ui/links/link-sheet/link-item";

export default function ConfidentialViewSection({
  data,
  setData,
  isAllowed,
  handleUpgradeStateChange,
}: {
  data: any;
  setData: React.Dispatch<React.SetStateAction<any>>;
  isAllowed: boolean;
  handleUpgradeStateChange: (opts: any) => void;
}) {
  const { enableConfidentialView } = data;
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    setEnabled(!!enableConfidentialView);
  }, [enableConfidentialView]);

  const handleEnableConfidentialView = () => {
    const updated = !enabled;
    setData({
      ...data,
      enableConfidentialView: updated,
    });
    setEnabled(updated);
  };

  return (
    <div className="pb-5">
      <LinkItem
        title="Confidential view"
        tooltipContent="Prevent copying, printing, downloading, and screenshots."
        link="https://www.papermark.com/help"
        enabled={enabled}
        action={handleEnableConfidentialView}
        isAllowed={true}
        requiredPlan="business"
        upgradeAction={() => {}}
      />
    </div>
  );
}
