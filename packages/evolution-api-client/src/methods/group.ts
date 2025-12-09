export interface GroupInfo {
  id: string;
  subject: string;
  subjectOwner: string;
  subjectTime: number;
  pictureUrl: string | null;
  size: number;
  creation: number;
  owner: string;
  restrict: boolean;
  announce: boolean;
  isCommunity: boolean;
  isCommunityAnnounce: boolean;
  participants?: {
    id: string;
    phoneNumber: string;
    admin: string | null;
  }[];
}

export class GroupMethods {
  constructor(
    private request: <T>(
      method: string,
      path: string,
      body?: unknown,
    ) => Promise<T>,
  ) {}

  /**
   * Busca informações de um grupo específico pelo JID
   * GET /group/findGroupInfos/{instance}?groupJid={groupJid}
   */
  async findGroupInfos(
    instanceName: string,
    groupJid: string,
  ): Promise<GroupInfo | null> {
    try {
      return await this.request<GroupInfo>(
        "GET",
        `/group/findGroupInfos/${instanceName}?groupJid=${groupJid}`,
      );
    } catch {
      return null;
    }
  }

  /**
   * Busca todos os grupos da instância
   * GET /group/fetchAllGroups/{instance}?getParticipants={boolean}
   */
  async fetchAllGroups(
    instanceName: string,
    getParticipants = false,
  ): Promise<GroupInfo[]> {
    return this.request<GroupInfo[]>(
      "GET",
      `/group/fetchAllGroups/${instanceName}?getParticipants=${getParticipants}`,
    );
  }
}
