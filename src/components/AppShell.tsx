import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Clapperboard, Compass, Home, LogOut, MessageSquare, Plus, Settings, Shield, User } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { useBranding } from "@/lib/branding";
import { BrandLockup, BrandMark } from "@/components/Brand";
import { UploadDialog } from "@/components/UploadDialog";
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
  const { user, profile, isAdmin, signOut } = useAuth();
  const [uploadOpen, setUploadOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const branding = useBranding();

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = document.title.replace(/AURALIS/g, branding.site_name);
  }, [branding.site_name, pathname]);

  useEffect(() => {
    if (user && profile && !profile.setup_complete && pathname !== "/setup") {
      navigate({ to: "/setup", replace: true });
    }
  }, [user, profile, pathname, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="glass-panel sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center">
            <span className="hidden sm:block">
              <BrandLockup />
            </span>
            <span className="sm:hidden">
              <BrandMark />
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname === item.to
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-2">
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
