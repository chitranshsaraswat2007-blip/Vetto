import { ShieldCheck, UserPlus } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { CreateUserForm } from "@/components/users/user-forms";
import { requirePermission } from "@/lib/auth/guards";
import { roleLabels } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import {
  toggleUserActiveAction,
  updateUserRoleAction,
} from "@/lib/users/actions";
import { appRoles } from "@/lib/users/types";

export const metadata: Metadata = {
  title: "Users",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
});

export default async function UsersPage() {
  const actor = await requirePermission("users:manage");

  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { contentsUploaded: true } },
    },
  });

  const activeCount = users.filter((user) => user.isActive).length;

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Workspace users"
        description="Add members, assign the role that matches their responsibility, and deactivate accounts that should no longer sign in."
        actions={
          <Badge variant="outline">
            {users.length} members · {activeCount} active
          </Badge>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-ink-muted"
                strokeWidth={1.75}
              />
              <div>
                <CardTitle>Members</CardTitle>
                <CardDescription>
                  Role changes take effect on the member&apos;s next request.
                  Deactivated members lose access immediately.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-line">
              {users.map((user) => {
                const isSelf = user.id === actor.id;

                return (
                  <li
                    key={user.id}
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-ink">
                            {user.name}
                          </p>
                          {isSelf ? <Badge variant="accent">You</Badge> : null}
                          <Badge
                            variant={user.isActive ? "success" : "neutral"}
                          >
                            {user.isActive ? "Active" : "Deactivated"}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">
                          {user.email}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-muted">
                          {user._count.contentsUploaded} content · joined{" "}
                          {dateFormatter.format(user.createdAt)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {isSelf ? (
                          <Badge variant="outline">
                            {roleLabels[user.role]}
                          </Badge>
                        ) : (
                          <form
                            action={updateUserRoleAction}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="hidden"
                              name="userId"
                              value={user.id}
                            />
                            <label
                              htmlFor={`role-${user.id}`}
                              className="sr-only"
                            >
                              Role for {user.name}
                            </label>
                            <Select
                              id={`role-${user.id}`}
                              name="role"
                              defaultValue={user.role}
                              className="mt-0 h-8 w-auto text-xs"
                            >
                              {appRoles.map((role) => (
                                <option key={role} value={role}>
                                  {roleLabels[role]}
                                </option>
                              ))}
                            </Select>
                            <Button
                              type="submit"
                              variant="secondary"
                              size="sm"
                            >
                              Save role
                            </Button>
                          </form>
                        )}

                        {isSelf ? null : (
                          <form action={toggleUserActiveAction}>
                            <input
                              type="hidden"
                              name="userId"
                              value={user.id}
                            />
                            <input
                              type="hidden"
                              name="isActive"
                              value={user.isActive ? "false" : "true"}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                            >
                              {user.isActive ? "Deactivate" : "Reactivate"}
                            </Button>
                          </form>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card id="new-member">
          <CardHeader>
            <div className="flex items-start gap-3">
              <UserPlus
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-ink-muted"
                strokeWidth={1.75}
              />
              <div>
                <CardTitle>Add a member</CardTitle>
                <CardDescription>
                  New accounts are active immediately. Share the temporary
                  password directly; VETTO does not send email.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CreateUserForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
