import { redirect } from "next/navigation";
import NewUserForm from "@/components/users/NewUserForm";
import UsersTable from "@/components/users/UsersTable";
import { verifySession } from "@/lib/dal";
import { getAllUsers } from "@/lib/users";

export default async function UsersPage() {
  const currentUser = await verifySession();
  if (currentUser.role !== "ADMIN") {
    redirect("/");
  }

  const users = await getAllUsers();

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold text-foreground">Users</h1>

      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <NewUserForm />
        <UsersTable users={users} currentUserId={currentUser.id} />
      </div>
    </div>
  );
}
