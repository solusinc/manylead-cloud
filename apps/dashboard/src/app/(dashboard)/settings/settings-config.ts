import type { LucideIcon } from "lucide-react";
import { Building2, Cog, Plus, User, Users } from "lucide-react";

/**
 * Settings navigation configuration
 * Single source of truth for all settings breadcrumbs
 */
export const SETTINGS_NAV_ITEMS: {
  value: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "general", label: "Geral", icon: Cog },
  { value: "account", label: "Conta", icon: User },
  { value: "departments", label: "Departamentos", icon: Building2 },
  { value: "agents", label: "Membros", icon: Users },
  { value: "new-organization", label: "Criar Organização", icon: Plus },
];
