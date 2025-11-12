import { AlertTriangle } from "lucide-react";

import { Button } from "@manylead/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@manylead/ui/card";

export function DangerZone({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-destructive size-4" />
          <CardTitle>Zona de Perigo</CardTitle>
        </div>
        <CardDescription>
          Ações irreversíveis que afetam permanentemente sua organização.
        </CardDescription>
      </CardHeader>
      {children}
    </Card>
  );
}

export function DangerZoneItem({
  title,
  description,
  action,
  onAction,
  disabled,
}: {
  title: string;
  description: string;
  action: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  return (
    <>
      <CardContent className="space-y-1">
        <h4 className="font-medium">{title}</h4>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardContent>
      <CardFooter className="flex items-center justify-end gap-2 border-t pt-4">
        <Button
          variant="destructive"
          onClick={onAction}
          disabled={disabled}
          size="sm"
        >
          {action}
        </Button>
      </CardFooter>
    </>
  );
}
