import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useMe } from "@/lib/format";
import { endSession } from "@/lib/session";
import type { Me } from "@/lib/types";

// Guards a panel page: unauthenticated → /login, wrong role → its own panel.
export function PanelShell({
  role,
  title,
  children,
}: {
  role: Me["role"];
  title: string;
  children: (me: Me) => ReactNode;
}) {
  const { data: me, isLoading, isError } = useMe();

  if (isLoading) {
    return (
      <div className="grid min-h-svh place-items-center" data-testid="panel-loading">
        <Loader2 className="size-6 animate-spin text-gold" />
      </div>
    );
  }
  if (isError || !me) return <Navigate to="/login" replace />;
  if (me.role !== role) return <Navigate to={me.role === "admin" ? "/admin" : "/barbeiro"} replace />;

  return (
    <div className="grain relative min-h-svh">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-page/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/" data-testid="panel-home-link">
              <Logo />
            </Link>
            <span className="hidden h-6 w-px bg-line sm:block" />
            <span className="hidden text-sm text-muted-foreground sm:block" data-testid="panel-title">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium" data-testid="panel-user-name">{me.name}</p>
              <p className="text-xs text-muted-foreground">{me.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => endSession("/login")} data-testid="logout-button">
              <LogOut className="size-4" /> Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children(me)}</main>
    </div>
  );
}
