"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

import { Button } from "@manylead/ui/button";

import { NavFeedback } from "~/components/nav/nav-feedback";
import { usePermissions } from "~/lib/permissions";
import { ImportContactsDialog } from "~/components/contacts/import-contacts-dialog";

export function NavActions() {
  const { can } = usePermissions();
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      {can("manage", "Contact") && (
        <>
          <Button size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar contatos
          </Button>
          <ImportContactsDialog
            open={importDialogOpen}
            onOpenChange={setImportDialogOpen}
          />
        </>
      )}
    </div>
  );
}
