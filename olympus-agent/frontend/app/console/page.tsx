import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export default async function ConsolePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <Dashboard session={session} />;
}
