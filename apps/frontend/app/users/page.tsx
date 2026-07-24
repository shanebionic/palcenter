import { UserManagement } from "../../components/UserManagement";
import { ApplicationShell } from "../../components/ApplicationShell";

export default function UsersPage() {
  return (
    <ApplicationShell>
      <UserManagement />
    </ApplicationShell>
  );
}
