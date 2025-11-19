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

/**
 * Calcula duração entre duas datas
 * @param start Data inicial
 * @param end Data final
 * @returns String no formato "HH:MM" ou "Xd HH:MM" se tiver dias
 * @example "04:15" ou "2d 04:15"
 */
export function calculateDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  const diffMinutes = Math.floor(diffMs / 1000 / 60);
  const days = Math.floor(diffMinutes / 1440); // 1440 min = 1 dia
  const hours = Math.floor((diffMinutes % 1440) / 60);
  const minutes = diffMinutes % 60;

  const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  if (days > 0) {
    return `${days}d ${timeStr}`;
  }

  return timeStr;
}
