import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Clapperboard, Compass, Hop as Home, LogOut, MessageSquare, Plus, Settings, Shield, User } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { useBranding } from "@/lib/branding";
import { BrandLockup, BrandMark } from "@/components/Brand";
import { UploadDialog } from "@/components/UploadDialog";
import { GlobalSearch } from "@/components/GlobalSearch";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/shorts", label: "Shorts", icon: Clapperboard },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/messages", label: "Chat", icon: MessageSquare },
  { to: "/notifications", label: "Alerts", icon: Bell },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, profile, isAdmin, signOut } = useAuth();
  const [uploadOpen, setUploadOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const branding = useBranding();

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = document.title.replace(/ZYNORAIO/g, branding.site_name);
  }, [branding.site_name, pathname]);

  useEffect(() => {
    if (user && profile && !profile.setup_complete && pathname !== "/setup") {
      navigate({ to: "/setup", replace: true });
    }
  }, [user, profile, pathname, navigate]);

  // Authentication wall: the sign-in screen is the only public surface.
  const isAuthRoute = pathname === "/auth";
  useEffect(() => {
    if (!loading && !user && !isAuthRoute) {
      navigate({ to: "/auth", replace: true });
    }
  }, [loading, user, isAuthRoute, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (isAuthRoute || !user) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-6xl px-4 py-6">
          {loading ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : isAuthRoute ? (
            children
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="glass-panel sticky top-0 z-40 border-x-0 border-t-0">
        <div className="flex h-14 w-full items-center gap-2 pr-3 pl-2 sm:gap-3 sm:pr-4 sm:pl-3">
          <Link to="/" className="flex shrink-0 items-center">
            <span className="hidden sm:block">
              <BrandLockup size="sm" />
            </span>
            <span className="sm:hidden">
              <BrandMark className="size-7" />
            </span>
          </Link>

          <div className="hidden min-w-0 flex-1 md:block">
            <GlobalSearch placeholder="Search ZYNORAIO" />
          </div>

          <nav className="ml-auto hidden shrink-0 items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors lg:px-3",
                  pathname === item.to
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
                title={item.label}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-1">
            {user ? (
              <>
                <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5">
                  <Plus className="size-4" /> <span className="hidden sm:inline">Create</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <UserAvatar
                      url={profile?.avatar_url}
                      name={profile?.display_name || profile?.username || "Me"}
                      className="size-9"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="truncate">
                      @{profile?.username ?? "account"}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/u/$username" params={{ username: profile?.username ?? "" }}>
                        <User className="size-4" /> My profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/settings">
                        <Settings className="size-4" /> Settings
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin ? (
                      <DropdownMenuItem asChild>
                        <Link to="/admin">
                          <Shield className="size-4" /> Admin console
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleSignOut}>
                      <LogOut className="size-4" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="px-3 pb-3 md:hidden">
          <GlobalSearch placeholder="Search ZYNORAIO" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 md:pb-12">{children}</main>

      <nav className="glass-panel fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 md:hidden">
        <div className="grid grid-cols-6">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 py-3 text-[11px] font-medium",
                pathname === item.to ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => (user ? setUploadOpen(true) : navigate({ to: "/auth" }))}
            className="flex flex-col items-center gap-1 py-3 text-[11px] font-medium text-muted-foreground"
          >
            <Plus className="size-5" />
            Create
          </button>
        </div>
      </nav>

      {user ? <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} /> : null}
    </div>
  );
}
