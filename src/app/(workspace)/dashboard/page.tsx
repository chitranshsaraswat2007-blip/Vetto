import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";

export default async function DashboardPage() {
  const user = await requireUser();

  switch (user.role) {
    case "CREATOR":
      redirect("/dashboard/creator");
    case "MANAGER":
      redirect("/dashboard/manager");
    case "SUPERVISOR":
      redirect("/dashboard/supervisor");
    case "ADMIN":
      redirect("/dashboard/admin");
    default:
      redirect("/dashboard/creator");
  }
}