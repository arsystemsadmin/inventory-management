"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoreFormDialog } from "./store-form-dialog";

export function NewStoreButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}><Plus /> New store</Button>
      <StoreFormDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
