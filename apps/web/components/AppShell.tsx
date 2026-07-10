"use client";

import { Bell, BookOpen, CalendarCheck, Dumbbell, Home, Landmark, ListChecks, ListTodo, LogOut, Moon, Settings, Target, Utensils, Workflow } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/work", label: "Work", icon: Workflow },
  { href: "/planner", label: "Planner", icon: CalendarCheck },
  { href: "/finance", label: "Finance", icon: Landmark },
  { href: "/workout", label: "Workout", icon: Dumbbell },
  { href: "/diet", label: "Diet", icon: Utensils },
  { href: "/reading", label: "Reading", icon: BookOpen },
  { href: "/habits", label: "Habits", icon: ListChecks },
  { href: "/weekly-review", label: "Review", icon: ListTodo },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  const activeItemLabel = nav.find((item) => isActivePath(pathname, item.href))?.label ?? "Home";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <div className="min-h-screen overflow-x-hidden text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-white/10 bg-sidebar px-4 py-5 text-sidebarForeground shadow-lift lg:block">
        <Link href="/" className="mb-6 flex items-center gap-3 rounded-lg px-2 py-1.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-white shadow-soft">
            <Target size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-wide">Personal OS</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-sidebarMuted">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Private command center
            </div>
          </div>
        </Link>
        <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sidebarMuted">Today</div>
          <div className="mt-1 text-sm font-semibold">{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</div>
        </div>
        <nav className="space-y-1.5">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebarMuted transition hover:bg-white/[0.07] hover:text-white",
                  active && "bg-white/[0.12] text-white shadow-soft ring-1 ring-white/10",
                )}
              >
                <span className={cn("absolute left-0 h-5 w-0.5 rounded-full bg-accent opacity-0 transition", active && "opacity-100")} />
                <Icon size={17} className={cn("transition group-hover:text-white", active && "text-accent")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b bg-card/95 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Today</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold">
                <span>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</span>
                <span className="hidden rounded-lg border bg-surface px-2 py-0.5 text-xs font-medium text-muted sm:inline-flex">{activeItemLabel}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/work" className="inline-flex h-10 items-center justify-center rounded-lg border bg-card px-3 text-sm font-semibold shadow-sm transition hover:border-accent/50 hover:text-accent">
                Work critical
              </Link>
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-card shadow-sm transition hover:border-accent/50 hover:text-accent"
                onClick={() => setDark((value) => !value)}
                aria-label="Toggle theme"
              >
                <Moon size={17} />
              </button>
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-card shadow-sm transition hover:border-danger/50 hover:text-danger"
                onClick={signOut}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
          <nav className="flex max-w-full gap-2 overflow-x-auto px-3 pb-3 sm:px-6 lg:hidden">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} className={cn("flex shrink-0 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium shadow-sm", active && "border-accent bg-accent/10 text-accent")}>
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
