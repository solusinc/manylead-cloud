export function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "numeric",
    minute: "numeric",
  });
}

export function formatNumber(value: number) {
  return `${Intl.NumberFormat("pt-BR").format(value)}`;
}
