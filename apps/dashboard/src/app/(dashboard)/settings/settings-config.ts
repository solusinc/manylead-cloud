import type { LucideIcon } from "lucide-react";
import { Building, Building2, User, Users } from "lucide-react";

/**
 * Settings navigation configuration
 * Single source of truth for all settings breadcrumbs
 */
export const SETTINGS_NAV_ITEMS: {
  value: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "organization", label: "Organização", icon: Building2 },
  { value: "account", label: "Conta", icon: User },
  { value: "departments", label: "Departamentos", icon: Building },
  { value: "agents", label: "Membros", icon: Users },
  // Temporarily hidden - user creation of organizations disabled
  // { value: "new-organization", label: "Criar Organização", icon: Plus },
];
