import { useDataroom, useDataroomLinks } from "@/shared/utils/swr/use-dataroom";

import StatsCard from "@/shared/ui/datarooms/stats-card";
import AppLayout from "@/shared/ui/layouts/app";
import LinksTable from "@/shared/ui/links/links-table";
import DataroomVisitorsTable from "@/shared/ui/visitors/dataroom-visitors-table";

export default function DataroomPage() {
  const { dataroom } = useDataroom();
  const { links } = useDataroomLinks();

  if (!dataroom) {
    return <div>Loading...</div>;
  }

  return (
    <AppLayout>
      <div className="relative mx-2 mb-10 mt-4 space-y-8 overflow-hidden px-1 sm:mx-3 md:mx-5 md:mt-5 lg:mx-7 lg:mt-8 xl:mx-10">
        <div className="space-y-1">
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">
            Overview
          </h3>
        </div>

        <div className="space-y-4">
          <StatsCard />

          <LinksTable
            links={links}
            targetType={"DATAROOM"}
            dataroomName={dataroom.name}
          />

          <DataroomVisitorsTable dataroomId={dataroom.id} />
        </div>
      </div>
    </AppLayout>
  );
}
