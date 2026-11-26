import { redirect } from "next/navigation";

export default function DevHome() {
  redirect("/dev/errors");
}
