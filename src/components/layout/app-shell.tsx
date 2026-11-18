"use client";

import { LogOut, Menu, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import {
  getNavigationItem,
  getNavigationSections,
  type NavigationSection,
} from "@/lib/navigation";
import { logoutAction } from "@/lib/auth/actions";
import {
  hasPermission,
  roleLabels,
} from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SidebarNavigation({
  pathname,
  sections,
  onNavigate,
}: {
  pathname: string;
  sections: NavigationSection[];
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-6">
      {sections.map((section) => (
        <div key={section.label} className="mb-7 last:mb-0">
          <p className="px-2 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-muted">
            {section.label}
          </p>
          <ul className="mt-2 space-y-0.5">
            {section.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-surface-muted font-medium text-ink before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent"
                        : "text-ink-soft hover:bg-surface-muted hover:text-ink",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0",
                        active
                          ? "text-accent"
                          : "text-ink-muted group-hover:text-ink-soft",
                      )}
                      strokeWidth={1.75}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter({ user }: { user: SessionUser }) {
  return (
    <div className="border-t border-line p-3">
      <div className="rounded-md border border-line bg-surface-muted p-3">
        <div className="flex items-start gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-medium text-surface">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink">{user.name}</p>
            <p className="truncate text-[10px] text-ink-muted">{user.email}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
              {roleLabels[user.role]}
            </p>
          </div>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="size-7 px-0"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut aria-hidden="true" className="size-3.5" />
            </Button>
          </form>
        </div>
      </div>
      <p className="mt-2 px-1 text-[9px] uppercase tracking-[0.16em] text-ink-muted">
        VETTO · Brand intelligence
      </p>
    </div>
  );
}

export function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user: SessionUser;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const currentItem = getNavigationItem(pathname, user.role);
  const canManageSettings = hasPermission(user.role, "settings:manage");

  const visibleSections = getNavigationSections(user.role)
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          !item.permission || hasPermission(user.role, item.permission),
      ),
    }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileCloseRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-dvh">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17.5rem] flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center border-b border-line px-5">
          <BrandMark />
        </div>
        <SidebarNavigation pathname={pathname} sections={visibleSections} />
        <SidebarFooter user={user} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            tabIndex={-1}
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-ink/25"
          />
          <aside
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative flex h-full w-[18rem] max-w-[85vw] flex-col border-r border-line bg-surface shadow-raised"
          >
            <div className="flex h-16 items-center justify-between border-b border-line px-5">
              <BrandMark />
              <button
                ref={mobileCloseRef}
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="flex size-8 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <SidebarNavigation
              pathname={pathname}
              sections={visibleSections}
              onNavigate={() => setMobileOpen(false)}
            />
            <SidebarFooter user={user} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[17.5rem]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-canvas px-5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line-strong bg-surface text-ink-soft transition-colors hover:text-ink lg:hidden"
            >
              <Menu aria-hidden="true" className="size-4" />
            </button>
            <div className="hidden items-center gap-2 text-xs text-ink-muted lg:flex">
              <span>Workspace</span>
              <span aria-hidden="true">/</span>
              <span className="text-ink-soft">
                {currentItem?.label ?? "Overview"}
              </span>
            </div>
            <div className="lg:hidden">
              <BrandMark />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted sm:inline">
              {roleLabels[user.role]}
            </span>
            {canManageSettings ? (
              <Link
                href="/settings"
                aria-label="Settings"
                className="flex size-9 items-center justify-center rounded-md border border-line-strong bg-surface text-ink-soft transition-colors hover:text-ink"
              >
                <Settings aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
            <form action={logoutAction} className="lg:hidden">
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="size-9 px-0"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut aria-hidden="true" className="size-3.5" />
              </Button>
            </form>
          </div>
        </header>

        <main
          id="main-content"
          className="workspace-main mx-auto w-full max-w-[76rem] px-5 py-8 sm:px-8 lg:px-10 lg:py-12"
        >
          {children}
        </main>

        <footer className="mx-auto flex w-full max-w-[76rem] flex-col gap-1 border-t border-line px-5 py-6 text-[11px] text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <span className="uppercase tracking-[0.16em]">
            VETTO — Brand content intelligence
          </span>
          <span>{roleFooterLabel(user.role)}</span>
        </footer>
      </div>
    </div>
  );
}

function roleFooterLabel(role: SessionUser["role"]) {
  return role === "ADMIN"
    ? "Administrator workspace"
    : `${roleLabels[role]} workspace`;
}
