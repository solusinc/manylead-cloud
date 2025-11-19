import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Formata data/hora no formato HH:mm (ex: 15:04)
 */
export function formatTime(date: Date): string {
  return format(date, "HH:mm", { locale: ptBR });
}

/**
 * Formata data/hora no formato "dd/MM/yyyy às HH:mm"
 */
export function formatDateTime(date: Date): string {
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

/**
 * Formata apenas a data no formato "dd/MM/yyyy"
 */
export function formatDate(date: Date): string {
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}
