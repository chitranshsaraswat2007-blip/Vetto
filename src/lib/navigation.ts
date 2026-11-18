import {
  ClipboardCheck,
  Files,
  Fingerprint,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Permission } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/auth/types";

export type NavigationItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  permission?: Permission;
};

export type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

export function getNavigationSections(role: AppRole): NavigationSection[] {
  const baseSections: NavigationSection[] = [
    {
      label: "Overview",
      items: [
        {
          href: "/dashboard",
          label: "Dashboard",
          description: "Workspace overview and next actions",
          icon: LayoutDashboard,
        },
      ],
    },
  ];

  const creatorSections: NavigationSection[] = [
    {
      label: "My Work",
      items: [
        {
          href: "/content",
          label: "Content",
          description: "Uploaded creative and documents",
          icon: Files,
        },
        {
          href: "/content/new",
          label: "Upload",
          description: "Create new content for review",
          icon: Files,
        },
      ],
    },
  ];

  const managerSections: NavigationSection[] = [
    {
      label: "Review",
      items: [
        {
          href: "/reviews",
          label: "Review Queue",
          description: "Findings waiting for a decision",
          icon: ClipboardCheck,
        },
        {
          href: "/content",
          label: "All Content",
          description: "Browse all uploaded creative",
          icon: Files,
        },
      ],
    },
  ];

  const supervisorSections: NavigationSection[] = [
    {
      label: "Review",
      items: [
        {
          href: "/reviews",
          label: "Assigned Reviews",
          description: "Manager-approved reviews assigned to you",
          icon: ClipboardCheck,
        },
        {
          href: "/content",
          label: "All Content",
          description: "Browse all uploaded creative",
          icon: Files,
        },
      ],
    },
  ];

  const adminSections: NavigationSection[] = [
    {
      label: "Workspace",
      items: [
        {
          href: "/content",
          label: "Content",
          description: "Uploaded creative and documents",
          icon: Files,
        },
        {
          href: "/reviews",
          label: "Reviews",
          description: "Review queue and decisions",
          icon: ClipboardCheck,
        },
      ],
    },
    {
      label: "Governance",
      items: [
        {
          href: "/brands",
          label: "Brands",
          description: "Brand identity, assets, and rules",
          icon: Fingerprint,
        },
        {
          href: "/users",
          label: "Users",
          description: "Workspace members and roles",
          icon: Users,
        },
      ],
    },
    {
      label: "Configure",
      items: [
        {
          href: "/settings",
          label: "Settings",
          description: "Workspace and runtime configuration",
          icon: Settings,
          permission: "settings:manage",
        },
      ],
    },
  ];

  switch (role) {
    case "CREATOR":
      return [...baseSections, ...creatorSections];
    case "MANAGER":
      return [...baseSections, ...managerSections];
    case "SUPERVISOR":
      return [...baseSections, ...supervisorSections];
    case "ADMIN":
      return [...baseSections, ...adminSections];
    default:
      return baseSections;
  }
}

export function getNavigationItems(role: AppRole): NavigationItem[] {
  return getNavigationSections(role).flatMap((section) => section.items);
}

export function getNavigationItem(pathname: string, role: AppRole): NavigationItem | undefined {
  return getNavigationItems(role).find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
