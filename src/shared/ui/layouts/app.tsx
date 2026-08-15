import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Sidebar } from "@/shared/ui/sidebar";
import { Menu, X, Bell, User as UserIcon } from "lucide-react";
import { useSession } from "next-auth/react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50 flex w-72 flex-col bg-card">
            <div className="flex items-center justify-between border-b p-4">
              <span className="font-bold text-lg">Dossier</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href="/dashboard" className="hover:text-foreground font-medium">
                Home
              </Link>
              <span>/</span>
              <span className="capitalize font-semibold text-foreground">
                {router.pathname.replace("/", "") || "Dashboard"}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button className="rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors">
              <Bell className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 rounded-full border bg-muted/40 py-1 px-3 text-xs">
              <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-foreground">{session?.user?.name || "Account"}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-muted/10 p-4 md:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
