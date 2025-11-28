export interface CreateAPIClientOptions {
  baseURL: string;
  apiKey: string;
  logger?: {
    debug: (data: { method: string; path: string }, message: string) => void;
    error: (
      data: {
        method: string;
        path: string;
        status: number;
        error: unknown;
      },
      message: string,
    ) => void;
  };
}
