import { useRouter } from "next/router";
import { useEffect } from "react";
import AppLayout from "@/components/layouts/app";
import LoadingSpinner from "@/components/ui/loading-spinner";

export default function DataroomAnalyticsPage() {
  const router = useRouter();
  const { id } = router.query as { id?: string };

  useEffect(() => {
    if (id) {
      router.replace(`/datarooms/${id}/documents`);
    } else {
      router.replace("/datarooms");
    }
  }, [id, router]);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <LoadingSpinner className="h-10 w-10" />
      </div>
    </AppLayout>
  );
}
