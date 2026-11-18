"use client";

import { useState } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { roleLabels } from "@/lib/auth/permissions";

import { AuthPanel, type DevelopmentAccount } from "./auth-panel";

const developmentEmails = [
  { role: "Creator" as const, email: "creator@vetto.test" },
  { role: "Manager" as const, email: "manager@vetto.test" },
  { role: "Supervisor" as const, email: "supervisor@vetto.test" },
  { role: "Admin" as const, email: "admin@vetto.test" },
];

const portals = [
  {
    role: "CREATOR" as const,
    title: "Creator",
    description: "Upload content, inspect findings, submit for review",
    icon: "upload",
  },
  {
    role: "MANAGER" as const,
    title: "Manager",
    description: "Review queue, approve, request changes, waive with reason",
    icon: "clipboard",
  },
  {
    role: "SUPERVISOR" as const,
    title: "Supervisor",
    description: "Review approved items assigned by a Manager",
    icon: "gavel",
  },
  {
    role: "ADMIN" as const,
    title: "Admin",
    description: "Manage users, brands, rules, workspace settings",
    icon: "shield",
  },
];

type PortalRole = (typeof portals)[number]["role"];

export function LoginClient() {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const developmentAccounts: DevelopmentAccount[] = isDevelopment
    ? developmentEmails.map((account) => ({
        role: roleLabels[account.role.toUpperCase() as keyof typeof roleLabels],
        email: account.email,
        password: "Vetto!Dev123",
      }))
    : [];

  const [preselectedAccount, setPreselectedAccount] =
    useState<DevelopmentAccount | null>(null);
  const [selectedPortal, setSelectedPortal] = useState<PortalRole | null>(
    isDevelopment ? "CREATOR" : null,
  );

  const handlePortalClick = (portalRole: PortalRole, portalTitle: string) => {
    setSelectedPortal(portalRole);
    const account = developmentAccounts.find((item) => item.role === portalTitle);
    if (account) {
      setPreselectedAccount(account);
    }
  };

  return (
    <section className="flex flex-col">
      <div className="lg:hidden">
        <BrandMark href="/login" />
      </div>

      <div className="mt-8 space-y-6">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            Choose who you are
          </p>
          <p className="mt-1 text-sm leading-6 text-ink-soft">
            Select your role, then sign in with that account.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {portals.map((portal) => (
            <button
              key={portal.role}
              type="button"
              onClick={() => handlePortalClick(portal.role, portal.title)}
              aria-pressed={selectedPortal === portal.role}
              className={`login-role-card relative rounded-lg border p-5 text-left transition-colors hover:border-line-strong hover:bg-surface-muted ${
                selectedPortal === portal.role
                  ? "border-accent/40 bg-accent-soft/40 ring-1 ring-accent/20"
                  : "border-line bg-surface"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="login-role-icon flex size-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                  {portal.icon === "upload" && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  )}
                  {portal.icon === "clipboard" && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" />
                    </svg>
                  )}
                  {portal.icon === "gavel" && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="22" y2="13" />
                      <line x1="16" y1="17" x2="22" y2="17" />
                      <line x1="10" y1="19" x2="10.01" y2="19" />
                    </svg>
                  )}
                  {portal.icon === "shield" && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="font-medium text-ink">{portal.title}</p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">{portal.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        {selectedPortal && !isDevelopment ? (
          <p className="text-[11px] leading-5 text-ink-muted" aria-live="polite">
            Sign in with the email for your {portals.find((portal) => portal.role === selectedPortal)?.title} account. Your role is verified from your account after sign-in.
          </p>
        ) : null}
      </div>

      <div
        className={
          isDevelopment
            ? "mt-8 rounded-lg border border-line bg-surface/60 p-4"
            : "mt-6"
        }
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
          {isDevelopment ? "Or sign in with email" : "Sign in with email"}
        </p>
        <AuthPanel
          developmentAccounts={developmentAccounts}
          preselectedAccount={preselectedAccount}
        />
      </div>

      <p className="mt-6 text-[11px] leading-5 text-ink-muted text-center">
        Roles and permissions are enforced on the server. Changing a URL
        or interface control does not grant additional access.
      </p>
    </section>
  );
}
