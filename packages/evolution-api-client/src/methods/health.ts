export class HealthMethods {
  constructor(
    private request: <T>(
      method: string,
      path: string,
      body?: unknown,
    ) => Promise<T>,
  ) {}

  /**
   * Verifica se a API está respondendo
   */
  async check(): Promise<{ status: number; message: string }> {
    return this.request<{ status: number; message: string }>("GET", "/");
  }
}
