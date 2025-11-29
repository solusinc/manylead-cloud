import { Check, CheckCheck, Clock } from "lucide-react";
import { cn } from "@manylead/ui";

export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

interface MessageStatusIconProps {
  status: MessageStatus;
  className?: string;
  size?: number;
}

/**
 * WhatsApp-style message status icons
 *
 * - pending: Clock (cinza claro)
 * - sent: 1 Check (cinza)
 * - delivered: 2 Checks (cinza)
 * - read: 2 Checks (azul)
 * - failed: hidden (tratado no nível superior)
 */
export function MessageStatusIcon({ status, className, size = 16 }: MessageStatusIconProps) {
  const iconClass = cn(
    "shrink-0",
    {
      "text-muted-foreground/50": status === "pending",
      "text-muted-foreground": status === "sent" || status === "delivered",
      "text-blue-500": status === "read",
    },
    className
  );

  switch (status) {
    case "pending":
      return <Clock className={iconClass} size={size} />;
    case "sent":
      return <Check className={iconClass} size={size} />;
    case "delivered":
      return <CheckCheck className={iconClass} size={size} />;
    case "read":
      return <CheckCheck className={iconClass} size={size} />;
    case "failed":
      return null;
    default:
      return null;
  }
}
