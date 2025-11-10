"use client";

import type * as React from "react";
import { useState, useTransition } from "react";

import type { LucideIcon } from "lucide-react";
import { MoreHorizontal, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from "@manylead/ui";
import type { DropdownMenuContentProps } from "@radix-ui/react-dropdown-menu";
import { isTRPCClientError } from "@trpc/client";
import { toast } from "sonner";

interface QuickActionsProps extends React.ComponentProps<typeof Button> {
  align?: DropdownMenuContentProps["align"];
  side?: DropdownMenuContentProps["side"];
  actions?: {
    id: string;
    label: string;
    icon: LucideIcon;
    variant: "default" | "destructive";
    onClick?: () => Promise<void> | void;
  }[];
  deleteAction?: {
    title: string;
    /**
     * If set, an input field will require the user input to validate deletion
     */
    confirmationValue?: string;
    submitAction?: () => Promise<void>;
  };
}

export function QuickActions({
  align = "end",
  side,
  className,
  actions,
  deleteAction,
  children,
  ...props
}: QuickActionsProps) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      if (!deleteAction?.submitAction) return;
      const promise = deleteAction.submitAction();
      toast.promise(promise, {
        loading: "Deletando...",
        success: "Deletado",
        error: (error: unknown) => {
          if (isTRPCClientError(error)) {
            return error.message;
          }
          return "Falha ao deletar";
        },
      });
      try {
        await promise;
      } catch (error) {
        console.error("Failed to delete:", error);
      } finally {
        setOpen(false);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {children ?? (
            <Button
              variant="ghost"
              size="icon"
              className={className ?? "h-7 w-7 data-[state=open]:bg-accent"}
              {...props}
            >
              <MoreHorizontal />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} side={side} className="w-36">
          <DropdownMenuLabel className="sr-only">
            Ações Rápidas
          </DropdownMenuLabel>
          {actions
            ?.filter((item) => item.id !== "delete")
            .map((item) => (
              <DropdownMenuGroup key={item.id}>
                <DropdownMenuItem
                  variant={item.variant}
                  disabled={!item.onClick}
                  onClick={() => {
                    void item.onClick?.();
                  }}
                >
                  <item.icon className="text-muted-foreground" />
                  <span className="truncate">{item.label}</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            ))}
          {deleteAction && (
            <>
              {/* NOTE: add a separator only if actions exist */}
              {actions?.length ? <DropdownMenuSeparator /> : null}
              <AlertDialogTrigger asChild>
                <DropdownMenuItem variant="destructive">
                  <Trash2 className="text-muted-foreground" />
                  Deletar
                </DropdownMenuItem>
              </AlertDialogTrigger>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent
        onCloseAutoFocus={() => {
          // NOTE: bug where the body is not clickable after closing the alert dialog
          document.body.style.pointerEvents = "";
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            Tem certeza que deseja deletar `{deleteAction?.title}`?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. Isto irá remover permanentemente o
            registro do banco de dados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteAction?.confirmationValue ? (
          <form id="form-alert-dialog" className="space-y-0.5">
            <p className="text-muted-foreground text-xs">
              Por favor escreva &apos;
              <span className="font-semibold">
                {deleteAction.confirmationValue}
              </span>
              &apos; para confirmar
            </p>
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
          </form>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40"
            disabled={
              Boolean(
                deleteAction?.confirmationValue &&
                  value !== deleteAction.confirmationValue,
              ) || isPending
            }
            form="form-alert-dialog"
            type="submit"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              void handleDelete();
            }}
          >
            {isPending ? "Deletando..." : "Deletar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
