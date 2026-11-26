"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoreFormDialog } from "./store-form-dialog";
import { useT } from "@/i18n/client";

export function NewStoreButton() {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}><Plus /> {t("stores.newStore")}</Button>
      <StoreFormDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
