export interface ScheduledMessageItem {
  scheduledMessage: {
    id: string;
    contentType: string;
    content: string;
    scheduledAt: Date | string;
    cancelOnContactMessage?: boolean | null;
    cancelOnAgentMessage?: boolean | null;
    cancelOnChatClose?: boolean | null;
    quickReplyId?: string | null;
    quickReplyTitle?: string | null;
  };
  createdByAgent?: {
    id: string;
  } | null;
  createdByUser?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  chat?: {
    id: string;
  } | null;
  contact?: {
    id: string;
    name: string | null;
  } | null;
}

export interface CalendarData {
  items: ScheduledMessageItem[];
}
