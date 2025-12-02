export interface ScheduledMessageItem {
  scheduledMessage: {
    id: string;
    contentType: string;
    scheduledAt: Date | string;
  };
}

export interface CalendarData {
  items: ScheduledMessageItem[];
}
