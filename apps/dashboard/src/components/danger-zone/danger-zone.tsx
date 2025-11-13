import { Button } from "@manylead/ui/button";
import { CardContent } from "@manylead/ui/card";
import {
  FormCard,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardTitle,
} from "~/components/forms/form-card";

export function DangerZone({ children }: { children: React.ReactNode }) {
  return (
    <FormCard variant="destructive">
      <FormCardHeader>
        <FormCardTitle>Zona de Perigo</FormCardTitle>
        <FormCardDescription>
          Esta ação não pode ser desfeita.
        </FormCardDescription>
      </FormCardHeader>
      {children}
    </FormCard>
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
      {(title || description) && (
        <CardContent className="space-y-1 px-4">
          {title && <h4 className="font-medium">{title}</h4>}
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </CardContent>
      )}
      <FormCardFooter variant="destructive" className="justify-end">
        <Button
          variant="destructive"
          onClick={onAction}
          disabled={disabled}
          size="sm"
        >
          {action}
        </Button>
      </FormCardFooter>
    </>
  );
}
