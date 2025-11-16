"use client";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import { MessageSquare, MessageSquarePlus } from "lucide-react";

export function ChatWindowEmpty({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full p-8 text-center",
        className
      )}
      {...props}
    >
      <ChatWindowEmptyIcon />
      <ChatWindowEmptyTitle>Selecione uma conversa</ChatWindowEmptyTitle>
      <ChatWindowEmptyDescription>
        Escolha uma conversa da lista ao lado ou inicie uma nova conversa interna
      </ChatWindowEmptyDescription>
      <ChatWindowEmptyAction />
    </div>
  );
}

export function ChatWindowEmptyIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("mb-6", className)} {...props}>
      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
        <MessageSquare className="w-12 h-12 text-muted-foreground" />
      </div>
    </div>
  );
}

export function ChatWindowEmptyTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("text-2xl font-semibold mb-2", className)} {...props}>
      {children}
    </h2>
  );
}

export function ChatWindowEmptyDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground mb-6 max-w-sm", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function ChatWindowEmptyAction({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button className={cn("", className)} {...props}>
      <MessageSquarePlus className="w-4 h-4 mr-2" />
      Iniciar conversa interna
    </Button>
  );
}
