import { format, isToday, isYesterday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Formata data/hora no formato HH:mm (ex: 15:04)
 */
export function formatTime(date: Date): string {
  return format(date, "HH:mm", { locale: ptBR });
}

/**
 * Formata data no estilo WhatsApp (para badges de data)
 * - "Hoje" se for hoje
 * - "Ontem" se foi ontem
 * - Nome do dia da semana se for nessa semana (ex: "Segunda-feira")
 * - "dd/MM/yyyy" se for mais antigo
 */
export function formatMessageDate(date: Date): string {
  if (isToday(date)) {
    return "Hoje";
  }
  if (isYesterday(date)) {
    return "Ontem";
  }
  if (isThisWeek(date, { weekStartsOn: 0 })) {
    return format(date, "EEEE", { locale: ptBR });
  }
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

/**
 * Formata timestamp no estilo WhatsApp (para footer de mensagens)
 * - "HH:mm" se for hoje
 * - "Ontem" se foi ontem
 * - Nome do dia da semana se for nessa semana (ex: "Segunda-feira")
 * - "dd/MM/yyyy" se for mais antigo
 */
export function formatMessageTimestamp(date: Date): string {
  if (isToday(date)) {
    return format(date, "HH:mm");
  }
  if (isYesterday(date)) {
    return "Ontem";
  }
  if (isThisWeek(date, { weekStartsOn: 0 })) {
    return format(date, "EEEE", { locale: ptBR });
  }
  return format(date, "dd/MM/yyyy", { locale: ptBR });
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
