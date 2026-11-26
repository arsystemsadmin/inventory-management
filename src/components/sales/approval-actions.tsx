"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useActions } from "@/lib/actions-context";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";

export function ApprovalActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const actions = useActions();
  const t = useT();
  const decide = (approve: boolean) => startTransition(async () => {
    const res = await actions.decideApproval(id, approve);
    if (res.ok) toast.success(res.message); else toast.error(res.error);
  });
  return (
    <div className="flex gap-2">
      <Button variant="outline" disabled={pending} onClick={() => decide(false)}>{t("approvals.reject")}</Button>
      <Button variant="success" disabled={pending} onClick={() => decide(true)}>{t("approvals.approve")}</Button>
    </div>
  );
}
