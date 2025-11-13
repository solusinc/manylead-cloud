/**
 * Timezones suportados pela aplicação
 * Baseados nos fusos horários globais mais utilizados
 */
export const TIMEZONES = [
  // Brasil
  { value: "America/Noronha", label: "Fernando de Noronha (FNT) GMT-2", offset: -2 },
  { value: "America/Sao_Paulo", label: "Brasília (BRT) GMT-3", offset: -3 },
  { value: "America/Manaus", label: "Amazon (AMT) GMT-4", offset: -4 },
  { value: "America/Rio_Branco", label: "Acre (ACT) GMT-5", offset: -5 },

  // Américas
  { value: "Pacific/Honolulu", label: "Hawaii-Aleutian (HAST) GMT-10", offset: -10 },
  { value: "Pacific/Pago_Pago", label: "Samoa (SST) GMT-11", offset: -11 },
  { value: "America/Anchorage", label: "Alaska (AKST) GMT-9", offset: -9 },
  { value: "America/Los_Angeles", label: "Pacific (PST) GMT-8", offset: -8 },
  { value: "America/Denver", label: "Mountain (MST) GMT-7", offset: -7 },
  { value: "America/Chicago", label: "Central (CST) GMT-6", offset: -6 },
  { value: "America/New_York", label: "Eastern (EST) GMT-5", offset: -5 },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (ART) GMT-3", offset: -3 },
  { value: "America/Santiago", label: "Chile (CLT) GMT-4", offset: -4 },
  { value: "America/Bogota", label: "Colombia (COT) GMT-5", offset: -5 },
  { value: "America/Lima", label: "Peru (PET) GMT-5", offset: -5 },

  // Europa e África
  { value: "America/Scoresbysund", label: "Eastern Greenland (EGT) GMT-1", offset: -1 },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT) GMT+0", offset: 0 },
  { value: "Europe/Paris", label: "Central European (CET) GMT+1", offset: 1 },
  { value: "Europe/Helsinki", label: "Eastern European (EET) GMT+2", offset: 2 },
  { value: "Europe/Moscow", label: "Moscow (MSK) GMT+3", offset: 3 },
  { value: "Europe/Istanbul", label: "Turkey (TRT) GMT+3", offset: 3 },
  { value: "Africa/Johannesburg", label: "South Africa (SAST) GMT+2", offset: 2 },

  // Ásia e Oceania
  { value: "Asia/Dubai", label: "Gulf (GST) GMT+4", offset: 4 },
  { value: "Asia/Karachi", label: "Pakistan (PKT) GMT+5", offset: 5 },
  { value: "Asia/Kolkata", label: "India (IST) GMT+5:30", offset: 5.5 },
  { value: "Asia/Dhaka", label: "Bangladesh (BST) GMT+6", offset: 6 },
  { value: "Asia/Bangkok", label: "Indochina (ICT) GMT+7", offset: 7 },
  { value: "Asia/Shanghai", label: "China (CST) GMT+8", offset: 8 },
  { value: "Asia/Tokyo", label: "Japan (JST) GMT+9", offset: 9 },
  { value: "Asia/Seoul", label: "Korea (KST) GMT+9", offset: 9 },
  { value: "Australia/Sydney", label: "Australian Eastern (AEST) GMT+10", offset: 10 },
  { value: "Australia/Perth", label: "Australian Western (AWST) GMT+8", offset: 8 },
  { value: "Pacific/Noumea", label: "New Caledonia (NCT) GMT+11", offset: 11 },
  { value: "Pacific/Auckland", label: "New Zealand (NZST) GMT+12", offset: 12 },
] as const;

export type TimezoneValue = typeof TIMEZONES[number]["value"];
