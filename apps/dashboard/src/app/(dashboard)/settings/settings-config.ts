import type { LucideIcon } from "lucide-react";
import { Building, MessageSquare, SlidersVertical, User, Users } from "lucide-react";

/**
 * Settings navigation configuration
 * Single source of truth for all settings breadcrumbs
 */
export const SETTINGS_NAV_ITEMS: {
  value: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "general", label: "Ajustes gerais", icon: SlidersVertical },
  { value: "account", label: "Conta", icon: User },
  { value: "departments", label: "Departamentos", icon: Building },
  { value: "channels", label: "Canais", icon: MessageSquare },
  { value: "users", label: "Usuários", icon: Users },
  // Temporarily hidden - user creation of organizations disabled
  // { value: "new-organization", label: "Criar Organização", icon: Plus },
];
