import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  ShieldCheck,
  PenTool,
  CheckCircle2,
  BarChart3,
  Settings,
  Palette,
  Users,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useTeam } from "@/features/workspace/providers/workspace-provider";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Files", href: "/files", icon: FolderOpen },
  { name: "Documents", href: "/datarooms", icon: FileText },
  { name: "Verification", href: "/verification", icon: ShieldCheck },
  { name: "Signing", href: "/signing", icon: PenTool },
  { name: "Completion", href: "/completion", icon: CheckCircle2 },
  { name: "Branding", href: "/branding", icon: Palette },
  { name: "Visitors", href: "/visitors", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const teamInfo = useTeam();

  const currentTeam = teamInfo?.currentTeam;

  return (
    <aside
      className={`flex h-screen w-64 flex-col border-r bg-card text-card-foreground ${className}`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold shadow">
            D
          </div>
          <span>Dossier</span>
        </Link>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          v2
        </span>
      </div>

      {/* Team / Workspace Selector */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-xs">
          <div className="truncate font-medium">
            {currentTeam?.name || session?.user?.name ? `${session?.user?.name || "My"}'s Team` : "Workspace"}
          </div>
          <span className="capitalize text-muted-foreground font-mono text-[10px]">
            {currentTeam?.plan || "Standard"}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            router.pathname === item.href ||
            (item.href !== "/dashboard" && router.pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                }`}
              />
              <span className="truncate">{item.name}</span>
              {item.badge && (
                <span className="ml-auto rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User / Logout Footer */}
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
            {session?.user?.name ? session.user.name[0].toUpperCase() : "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">
              {session?.user?.name || "User"}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {session?.user?.email || "user@dossier.com"}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
