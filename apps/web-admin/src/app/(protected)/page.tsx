import { redirect } from "next/navigation";

// Until the dashboard lands (6.6), the admin home is the hotel list.
export default function AdminHome() {
  redirect("/hotels");
}
