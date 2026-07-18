import { MonitorUserRepository } from "@/server/repositories/monitor-user.repository";
import { toErrorMessage } from "@/server/utils/api-error";
import { hashPassword } from "@/server/utils/password";
import type {
  AssignMonitorUsersBodyInput,
  CreateMonitorUserBodyInput,
  MonitorUserListQueryInput,
  MonitorUserPlantsQueryInput,
  MonitorUserStatusCountsQueryInput,
  RelateUserBodyInput,
} from '@/server/validators/monitor-user.validator';

interface ServiceError {
  status: 400 | 401 | 403 | 404 | 409 | 500;
  message: string;
}

interface LoginUserData {
  id: string;
  account: string;
  role: string;
  portal: string;
}

interface NumericMetric {
  value: number;
  unit: "kW" | "kWh";
}

interface RowStatus {
  online: number;
  standby: number;
  offline: number;
  abnormal: number;
}

interface MonitorUserItem {
  id: string;
  account: string;
  affiliation: string;
  capacity: number;
  power: NumericMetric;
  today: NumericMetric;
  total: NumericMetric;
  status: RowStatus;
  matched: {
    serialNumber: string | null;
    installationDate: string | null;
  };
}

interface StatusCounts {
  all: number;
  online: number;
  abnormal: number;
  standby: number;
  offline: number;
}

interface MonitorUserSummary {
  id: bigint;
  account: string;
  affiliation: string;
  capacity: number;
  power: number;
  today: number;
  total: number;
  status: RowStatus;
  matchedSerialNumber: string | null;
  matchedInstallationDate: string | null;
  updatedAt: Date;
}

interface ListSuccess {
  status: 200;
  message: string;
  data: {
    loginUser: LoginUserData;
    items: MonitorUserItem[];
    statusCounts: StatusCounts;
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
    filters: {
      status: MonitorUserListQueryInput["status"];
      sortBy: MonitorUserListQueryInput["sortBy"];
      sortOrder: MonitorUserListQueryInput["sortOrder"];
      searchUser: string;
      searchSN: string;
      searchInstallationDate: string;
      searchAffiliation: string;
    };
  };
}

interface StatusCountsSuccess {
  status: 200;
  message: string;
  data: {
    loginUser: Pick<LoginUserData, "id" | "account" | "role">;
    statusCounts: StatusCounts;
    updatedAt: string;
  };
}

interface LiveSummarySuccess {
  status: 200;
  message: string;
  data: {
    items: Array<{
      id: string;
      power: NumericMetric;
      today: NumericMetric;
      total: NumericMetric;
      status: RowStatus;
      updatedAt: string;
    }>;
  };
}

interface PlantsSuccess {
  status: 200;
  message: string;
  data: {
    monitorUser: {
      id: string;
      account: string;
    };
    items: Array<{
      id: string;
      name: string;
      installationDate: string | null;
      deviceCount: number;
      status: RowStatus;
    }>;
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  };
}

interface BulkUpdateSuccess {
  status: 200;
  message: string;
  data: {
    assignedToUserId?: string;
    relatedUserId?: string;
    monitorUserIds: string[];
    assignedCount?: number;
    relatedCount?: number;
    updatedAt: string;
  };
}

interface CreateSuccess {
  status: 201;
  message: string;
  data: {
    id: string;
    account: string;
    email: string | null;
    phone: string | null;
    timezone: string | null;
    role: string;
    portal: string;
    status: string;
    createdAt: string;
  };
}

export type MonitorUserListResult = ListSuccess | ServiceError;
export type MonitorUserStatusCountsResult = StatusCountsSuccess | ServiceError;
export type MonitorUserLiveSummaryResult = LiveSummarySuccess | ServiceError;
export type MonitorUserPlantsResult = PlantsSuccess | ServiceError;
export type MonitorUserBulkUpdateResult = BulkUpdateSuccess | ServiceError;
export type MonitorUserCreateResult = CreateSuccess | ServiceError;

type ScopedMonitorUser = Awaited<
  ReturnType<MonitorUserRepository["findScopedMonitorUsers"]>
>[number];

function normalizeDateOnly(date: Date | null): string | null {
  if (!date) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function normalizeStatusLabel(status: string | null | undefined): string {
  if (!status) {
    return "";
  }
  return status.toLowerCase();
}

function computeRowStatus(
  entries: Array<{ online: boolean; status: string | null }>,
): RowStatus {
  const rowStatus: RowStatus = {
    online: 0,
    abnormal: 0,
    standby: 0,
    offline: 0,
  };

  for (const entry of entries) {
    const statusLabel = normalizeStatusLabel(entry.status);

    if (statusLabel.includes("fault") || statusLabel.includes("abnormal")) {
      rowStatus.abnormal += 1;
      continue;
    }

    if (statusLabel.includes("standby")) {
      rowStatus.standby += 1;
      continue;
    }

    if (!entry.online || statusLabel.includes("offline")) {
      rowStatus.offline += 1;
      continue;
    }

    rowStatus.online += 1;
  }

  return rowStatus;
}

function hasStatusMatch(
  statusFilter: MonitorUserListQueryInput["status"],
  status: RowStatus,
): boolean {
  if (statusFilter === "all") {
    return true;
  }

  if (statusFilter === "online") {
    return status.online > 0;
  }

  if (statusFilter === "abnormal") {
    return status.abnormal > 0;
  }

  if (statusFilter === "standby") {
    return status.standby > 0;
  }

  return status.offline > 0;
}

function toStatusCounts(items: MonitorUserSummary[]): StatusCounts {
  let online = 0;
  let abnormal = 0;
  let standby = 0;
  let offline = 0;

  for (const item of items) {
    if (item.status.online > 0) {
      online += 1;
    }
    if (item.status.abnormal > 0) {
      abnormal += 1;
    }
    if (item.status.standby > 0) {
      standby += 1;
    }
    if (item.status.offline > 0) {
      offline += 1;
    }
  }

  return {
    all: items.length,
    online,
    abnormal,
    standby,
    offline,
  };
}

function toRow(item: MonitorUserSummary): MonitorUserItem {
  return {
    id: String(item.id),
    account: item.account,
    affiliation: item.affiliation,
    capacity: item.capacity,
    power: {
      value: item.power,
      unit: "kW",
    },
    today: {
      value: item.today,
      unit: "kWh",
    },
    total: {
      value: item.total,
      unit: "kWh",
    },
    status: item.status,
    matched: {
      serialNumber: item.matchedSerialNumber,
      installationDate: item.matchedInstallationDate,
    },
  };
}

export class MonitorUserService {
  constructor(
    private readonly monitorUserRepository: MonitorUserRepository = new MonitorUserRepository(),
  ) { }

  private async getActor(actorId: bigint) {
    return this.monitorUserRepository.findActorById(actorId);
  }

  private async validateActor(
    actorId: bigint,
    actorRole: string | undefined,
  ): Promise<LoginUserData | ServiceError> {
    if (actorRole !== "service_admin" && actorRole !== "service_super_admin") {
      return {
        status: 403,
        message: "You are not allowed to manage monitor users",
      };
    }

    const actor = await this.getActor(actorId);

    if (!actor || actor.isDeleted) {
      return {
        status: 401,
        message: "Unauthorized",
      };
    }

    if (actor.portal !== "service") {
      return {
        status: 403,
        message: "You are not allowed to manage monitor users",
      };
    }

    return {
      id: String(actor.id),
      account: actor.account,
      role: actor.role,
      portal: actor.portal,
    };
  }

  private async fetchScopedMonitorUsers(actorId: bigint, actorRole?: string) {
    return this.monitorUserRepository.findScopedMonitorUsers(
      actorId,
      actorRole,
    );
  }

  private async buildSummaries(
    monitorUsers: ScopedMonitorUser[],
    filters: Pick<
      MonitorUserStatusCountsQueryInput,
      "searchUser" | "searchSN" | "searchInstallationDate" | "searchAffiliation"
    >,
  ): Promise<MonitorUserSummary[]> {
    if (monitorUsers.length === 0) {
      return [];
    }

    const accounts = monitorUsers.map((user) => user.account);

    const assignerIds = Array.from(
      new Set(
        monitorUsers
          .map((user) => user.assignedById)
          .filter((id): id is bigint => typeof id === "bigint"),
      ),
    );

    const [plants, assigners] = await Promise.all([
      this.monitorUserRepository.findPlantsByAccounts(accounts),
      this.monitorUserRepository.findAssignersByIds(assignerIds),
    ]);

    const plantIds = plants.map((plant) => plant.id);

    const plantStatuses =
      plantIds.length > 0
        ? await this.monitorUserRepository.findPlantStatusesByPlantIds(plantIds)
        : [];

    const inverters =
      plantIds.length > 0
        ? await this.monitorUserRepository.findInvertersByPlantIds(plantIds)
        : [];

    const serialNumbers = inverters.map((item) => item.serialNumber);

    const latestLogs =
      serialNumbers.length > 0
        ? await this.monitorUserRepository.findLatestLogsBySerialNumbers(
          serialNumbers,
        )
        : [];

    const affiliationById = new Map(
      assigners.map((item) => [String(item.id), item.account]),
    );

    const plantsByAccount = new Map<string, typeof plants>();

    for (const plant of plants) {
      const current = plantsByAccount.get(plant.userAccount) ?? [];

      current.push(plant);

      plantsByAccount.set(plant.userAccount, current);
    }

    const invertersByPlant = new Map<string, typeof inverters>();

    for (const inverter of inverters) {
      const key = String(inverter.plantId);

      const current = invertersByPlant.get(key) ?? [];

      current.push(inverter);

      invertersByPlant.set(key, current);
    }

    const logsBySerial = new Map(latestLogs.map((log) => [log.sno, log]));

    const searchUser = filters.searchUser.trim().toLowerCase();

    const searchSN = filters.searchSN.trim().toLowerCase();

    const searchInstallationDate = filters.searchInstallationDate.trim();

    const searchAffiliation = filters.searchAffiliation.trim().toLowerCase();

    const statusByPlantId = new Map(
      plantStatuses.map((status) => [String(status.plantId), status]),
    );

    const summaries: MonitorUserSummary[] = [];
    const deviceEntries: Array<{
      online: boolean;
      status: string | null;
    }> = [];

    for (const user of monitorUsers) {
      const affiliation =
        (typeof user.assignedById === "bigint" &&
          affiliationById.get(String(user.assignedById))) ||
        "";

      const userPlants = plantsByAccount.get(user.account) ?? [];
      let totalDevices = 0;
      let normalCount = 0;
      let abnormalCount = 0;
      let standbyCount = 0;
      let offlineCount = 0;

      let power = 0;
      let today = 0;
      let total = 0;
      let capacity = 0;

      let latestUpdatedAt = user.updatedAt;

      const installationDate = normalizeDateOnly(user.createdAt);

      let hasSNMatch = searchSN.length === 0;

      let hasDateMatch = searchInstallationDate.length === 0;

      const serialNumbers: string[] = [];

      for (const plant of userPlants) {

        const plantStatus = statusByPlantId.get(String(plant.id));

        if (plantStatus) {
          totalDevices += plantStatus.totalDevices;
          normalCount += plantStatus.normalCount;
          abnormalCount += plantStatus.abnormalCount;
          standbyCount += plantStatus.standbyCount;
          offlineCount += plantStatus.offlineCount;
        }
        capacity += plant.kwp ?? 0;
        if (plant.updatedAt > latestUpdatedAt) {
          latestUpdatedAt = plant.updatedAt;
        }

        const plantInverters = invertersByPlant.get(String(plant.id)) ?? [];

        for (const inverter of plantInverters) {
          serialNumbers.push(inverter.serialNumber);

          if (
            searchSN.length > 0 &&
            inverter.serialNumber.toLowerCase().includes(searchSN)
          ) {
            hasSNMatch = true;
          }

          const latestLog = logsBySerial.get(inverter.serialNumber);

          if (latestLog) {
            power += Number(latestLog.currentPower ?? 0);

            today += Number(latestLog.dailyProduction ?? 0);

            total += Number(latestLog.totalEnergy ?? 0);
          }
        }
      }

      // Search installation date
      if (
        searchInstallationDate.length > 0 &&
        installationDate &&
        installationDate.includes(searchInstallationDate)
      ) {
        hasDateMatch = true;
      }

      if (
        searchUser.length > 0 &&
        !user.account.toLowerCase().includes(searchUser) &&
        !(user.email ?? "").toLowerCase().includes(searchUser) &&
        !(user.phone ?? "").toLowerCase().includes(searchUser)
      ) {
        continue;
      }

      if (
        searchAffiliation.length > 0 &&
        !affiliation.toLowerCase().includes(searchAffiliation)
      ) {
        continue;
      }

      if (!hasSNMatch || !hasDateMatch) {
        continue;
      }

      summaries.push({
        id: user.id,
        account: user.account,
        affiliation,
        capacity: capacity,

        power: power,
        today: today,
        total: total,

        status: {
          online: normalCount,
          abnormal: abnormalCount,
          standby: standbyCount,
          offline: offlineCount,
        },

        matchedSerialNumber: serialNumbers.join(", "),

        matchedInstallationDate: installationDate,

        updatedAt: latestUpdatedAt,
      });
    }

    return summaries;
  }

  private buildMonitorUserCsv(items: MonitorUserItem[]): string {
    const headers = [
      'Account',
      'Serial Number',
      'Installation Date',
      'Affiliation',
      'Capacity (kWp)',
      'Power',
      'Power Unit',
      'E-Today',
      'E-Today Unit',
      'E-Total',
      'E-Total Unit',
      'Status',
    ];

    const escape = (value: unknown): string =>
      `"${String(value ?? '').replace(/"/g, '""')}"`;

    const rows = items.map((item) => [
      escape(item.account),
      escape(item.matched.serialNumber),
      escape(item.matched.installationDate),
      escape(item.affiliation),
      escape(item.capacity),
      escape(item.power.value),
      escape(item.power.unit),
      escape(item.today.value),
      escape(item.today.unit),
      escape(item.total.value),
      escape(item.total.unit),
      escape(
        `online:${item.status.online}, abnormal:${item.status.abnormal}, Standby:${item.status.standby}, Offline:${item.status.offline},`
      ),
    ]);

    return [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');
  }




  async getMonitorUserList(
    actorId: bigint,
    actorRole: string | undefined,
    query: MonitorUserListQueryInput,
  ): Promise<MonitorUserListResult> {
    const actor = await this.validateActor(actorId, actorRole);
    if ("status" in actor) {
      return actor;
    }
    const loginUser: LoginUserData = actor;

    const monitorUsers = await this.fetchScopedMonitorUsers(actorId, actorRole);
    const summaries = await this.buildSummaries(monitorUsers, query);
    const statusCounts = toStatusCounts(summaries);

    const statusFiltered = summaries.filter((item) =>
      hasStatusMatch(query.status, item.status),
    );
    const sortOrderMultiplier = query.sortOrder === "asc" ? 1 : -1;
    statusFiltered.sort((a, b) => {
      if (query.sortBy === "power") {
        return (a.power - b.power) * sortOrderMultiplier;
      }
      if (query.sortBy === "today") {
        return (a.today - b.today) * sortOrderMultiplier;
      }
      if (query.sortBy === "total") {
        return (a.total - b.total) * sortOrderMultiplier;
      }

      return a.account.localeCompare(b.account) * sortOrderMultiplier;
    });

    const totalItems = statusFiltered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
    const safePage = Math.min(query.page, totalPages);
    const offset = (safePage - 1) * query.pageSize;
    const items = statusFiltered
      .slice(offset, offset + query.pageSize)
      .map(toRow);

    return {
      status: 200,
      message: "Monitor user list fetched successfully.",
      data: {
        loginUser,
        items,
        statusCounts,
        pagination: {
          page: safePage,
          pageSize: query.pageSize,
          totalItems,
          totalPages,
        },
        filters: {
          status: query.status,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
          searchUser: query.searchUser,
          searchSN: query.searchSN,
          searchInstallationDate: query.searchInstallationDate,
          searchAffiliation: query.searchAffiliation,
        },
      },
    };
  }

  async exportMonitorUsers(
    actorId: bigint,
    actorRole: string | undefined,
    query: MonitorUserListQueryInput,
  ): Promise<{
    status: number;
    message: string;
    csv: string;
  }> {
    const result = await this.getMonitorUserList(
      actorId,
      actorRole,
      query,
    );

    if (result.status !== 200) {
      return {
        status: result.status,
        message: result.message,
        csv: '',
      };
    }

    const csv = this.buildMonitorUserCsv(result.data.items);

    return {
      status: 200,
      message: 'Monitor users exported successfully.',
      csv,
    };
  }
  async getMonitorUserStatusCounts(
    actorId: bigint,
    actorRole: string | undefined,
    query: MonitorUserStatusCountsQueryInput,
  ): Promise<MonitorUserStatusCountsResult> {
    const actor = await this.validateActor(actorId, actorRole);
    if ('status' in actor) {
      return actor;
    }
    const loginUser: LoginUserData = actor;

    const monitorUsers = await this.fetchScopedMonitorUsers(actorId, actorRole);

    const accounts = monitorUsers.map((u) => u.account);

    const counts =
      await this.monitorUserRepository.getPlantStatusCountsForUsers(accounts);

    return {
      status: 200,
      message: "Monitor user status counts fetched successfully.",
      data: {
        loginUser: {
          id: loginUser.id,
          account: loginUser.account,
          role: loginUser.role,
        },
        statusCounts: {
          all: counts.totalDevices ?? 0,
          online: counts.normalCount ?? 0,
          abnormal: counts.abnormalCount ?? 0,
          standby: counts.standbyCount ?? 0,
          offline: counts.offlineCount ?? 0,
        },
        updatedAt: new Date().toISOString(),
      },
    };
  }

  async getMonitorUserLiveSummary(
    actorId: bigint,
    actorRole: string | undefined,
    monitorUserIds: bigint[],
  ): Promise<MonitorUserLiveSummaryResult> {
    const actor = await this.validateActor(actorId, actorRole);
    if ("status" in actor && actor.status !== undefined) {
      return actor;
    }

    const scopedUsers =
      await this.monitorUserRepository.findScopedMonitorUsersByIds(
        actorId,
        actorRole,
        monitorUserIds,
      );

    if (scopedUsers.length !== monitorUserIds.length) {
      return {
        status: 403,
        message: "One or more monitor users are outside your scope",
      };
    }

    const summaries = await this.buildSummaries(scopedUsers, {
      searchUser: "",
      searchSN: "",
      searchInstallationDate: "",
      searchAffiliation: "",
    });

    return {
      status: 200,
      message: "Live monitor user rows fetched successfully.",
      data: {
        items: summaries.map((item) => ({
          id: String(item.id),
          power: { value: item.power, unit: "kW" },
          today: { value: item.today, unit: "kWh" },
          total: { value: item.total, unit: "kWh" },
          status: item.status,
          updatedAt: item.updatedAt.toISOString(),
        })),
      },
    };
  }

  async getMonitorUserPlants(
    actorId: bigint,
    actorRole: string | undefined,
    monitorUserId: bigint,
    query: MonitorUserPlantsQueryInput,
  ): Promise<MonitorUserPlantsResult> {
    const actor = await this.validateActor(actorId, actorRole);
    if ("status" in actor && actor.status !== undefined) {
      return actor;
    }

    const monitorUser = await this.monitorUserRepository.findScopedMonitorUser(
      actorId,
      actorRole,
      monitorUserId,
    );

    if (!monitorUser) {
      return {
        status: 403,
        message: "You are not allowed to access this monitor user",
      };
    }

    const [totalItems, plants] = await Promise.all([
      this.monitorUserRepository.countPlantsByUserAccount(monitorUser.account),
      this.monitorUserRepository.findPlantsByUserAccount(
        monitorUser.account,
        query.page,
        query.pageSize,
      ),
    ]);

    const plantIds = plants.map((plant) => plant.id);
    const [inverters, dataloggers] =
      plantIds.length > 0
        ? await Promise.all([
          this.monitorUserRepository.findInvertersByPlantIds(plantIds),
          this.monitorUserRepository.findDataloggersByPlantIds(plantIds),
        ])
        : [[], []];

    const deviceEntriesByPlant = new Map<
      string,
      Array<{ online: boolean; status: string | null }>
    >();
    // for (const inverter of inverters) {
    // 	const key = String(inverter.plantId);
    // 	const current = deviceEntriesByPlant.get(key) ?? [];
    // 	current.push({ online: inverter.online, status: inverter.status });
    // 	deviceEntriesByPlant.set(key, current);
    // }
    for (const datalogger of dataloggers) {
      const key = String(datalogger.plantId);
      const current = deviceEntriesByPlant.get(key) ?? [];
      current.push({ online: datalogger.online, status: datalogger.status });
      deviceEntriesByPlant.set(key, current);
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));

    return {
      status: 200,
      message: "Monitor user plant list fetched successfully.",
      data: {
        monitorUser: {
          id: String(monitorUser.id),
          account: monitorUser.account,
        },
        items: plants.map((plant) => {
          const deviceEntries =
            deviceEntriesByPlant.get(String(plant.id)) ?? [];
          const status = computeRowStatus(deviceEntries);
          return {
            id: String(plant.id),
            name: plant.name,
            installationDate: normalizeDateOnly(plant.installed),
            deviceCount: deviceEntries.length,
            status: computeRowStatus(deviceEntries),
          };
        }),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          totalItems,
          totalPages,
        },
      },
    };
  }

  private async validateTargetServiceUser(
    targetUserId: bigint,
    actorId: bigint,
  ): Promise<ServiceError | null> {
    const target =
      await this.monitorUserRepository.findTargetServiceUser(targetUserId);

    if (!target) {
      return {
        status: 404,
        message: "Target service user not found",
      };
    }

    if (target.id !== actorId && target.assignedById !== actorId) {
      return {
        status: 403,
        message: "Target service user is outside your scope",
      };
    }

    return null;
  }

  private async updateMonitorUsersOwnership(
    monitorUserIdentifiers: string[],
    actorId: bigint,
    actorRole: string | undefined,
    targetUserId: bigint,
  ) {
    const exactIds: bigint[] = [];
    const accounts: string[] = [];

    // Separate numeric string IDs from account names
    for (const identifier of monitorUserIdentifiers) {
      if (/^\d+$/.test(identifier)) {
        exactIds.push(BigInt(identifier));
      } else {
        accounts.push(identifier);
      }
    }

    // Fetch BigInt IDs for any provided account names
    if (accounts.length > 0) {
      const usersByAccount =
        await this.monitorUserRepository.findUserIdsByAccounts(accounts);
      for (const user of usersByAccount) {
        exactIds.push(user.id);
      }
    }

    // Remove any duplicate BigInt values
    const uniqueIds = Array.from(new Set(exactIds));

    if (uniqueIds.length === 0) {
      return {
        error: {
          status: 400 as const,
          message: "No valid monitor users found from the provided identifiers",
        },
        updatedCount: 0,
      };
    }

    // Check permissions/scope against the final BigInt array
    const scopedUsers =
      await this.monitorUserRepository.findScopedMonitorUserIds(
        actorId,
        actorRole,
        uniqueIds,
      );

    if (scopedUsers.length !== uniqueIds.length) {
      return {
        error: {
          status: 403 as const,
          message: "One or more monitor users are outside your scope",
        },
        updatedCount: 0,
      };
    }

    const updated =
      await this.monitorUserRepository.updateMonitorUsersAssignedBy(
        actorId,
        actorRole,
        uniqueIds,
        targetUserId,
      );

    return {
      error: null,
      updatedCount: updated.count,
      resolvedIds: uniqueIds, // helpful for returning exact updated string IDs back to API response
    };
  }

  // async relateMonitorUsers(
  // 	actorId: bigint,
  // 	actorRole: string | undefined,
  // 	input: RelateMonitorUsersBodyInput,
  // ): Promise<MonitorUserBulkUpdateResult> {
  // 	const actor = await this.validateActor(actorId, actorRole);
  // 	if ('status' in actor && actor.status !== undefined) {
  // 		return actor;
  // 	}

  // 	const targetError = await this.validateTargetServiceUser(input.relatedUserId, actorId);
  // 	if (targetError) {
  // 		return targetError;
  // 	}

  // 	try {
  // 		const updated = await this.updateMonitorUsersOwnership(
  // 			input.monitorUserIds,
  // 			actorId,
  // 			actorRole,
  // 			input.relatedUserId,
  // 		);
  // 		if (updated.error) {
  // 			return updated.error;
  // 		}

  // 		return {
  // 			status: 200,
  // 			message: 'Monitor users related successfully.',
  // 			data: {
  // 				relatedUserId: String(input.relatedUserId),
  // 				monitorUserIds: input.monitorUserIds.map((id) => String(id)),
  // 				relatedCount: updated.updatedCount,
  // 				updatedAt: new Date().toISOString(),
  // 			},
  // 		};
  // 	} catch (error: unknown) {
  // 		return {
  // 			status: 500,
  // 			message: toErrorMessage(error),
  // 		};
  // 	}
  // }

  async relateMonitorUsers(
    actorId: bigint,
    actorRole: string | undefined,
    input: RelateUserBodyInput,
  ) {
    const actor = await this.validateActor(actorId, actorRole);
    if ('status' in actor) {
      return actor;
    }

    const user = await this.monitorUserRepository.findMonitorUserByAccount(
      input.account,
    );

    if (!user) {
      return {
        status: 404,
        message: 'Monitor user not found.',
      };
    }

    const existing =
      await this.monitorUserRepository.findMappingBySerialNumber(
        input.serialNumber,
      );

    if (existing) {
      return {
        status: 409,
        message: 'Serial number is already assigned.',
      };
    }

    await this.monitorUserRepository.createUserPlantMapping(
      user.id,
      input.serialNumber,
    );

    return {
      status: 200,
      message: 'User related successfully.',
      data: {
        account: user.account,
        serialNumber: input.serialNumber,
      },
    };
  }

  async assignMonitorUsers(
    actorId: bigint,
    actorRole: string | undefined,
    input: AssignMonitorUsersBodyInput,
  ): Promise<MonitorUserBulkUpdateResult> {
    const actor = await this.validateActor(actorId, actorRole);
    if ("status" in actor && actor.status !== undefined) {
      return actor;
    }

    const targetError = await this.validateTargetServiceUser(
      input.assignedToUserId,
      actorId,
    );
    if (targetError) {
      return targetError;
    }

    try {
      const updated = await this.updateMonitorUsersOwnership(
        input.monitorUserIds.map(String),
        actorId,
        actorRole,
        input.assignedToUserId,
      );
      if (updated.error) {
        return updated.error;
      }

      return {
        status: 200,
        message: "Monitor users assigned successfully.",
        data: {
          assignedToUserId: String(input.assignedToUserId),
          monitorUserIds: updated.resolvedIds.map((id) => String(id)),
          assignedCount: updated.updatedCount,
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error: unknown) {
      return {
        status: 500,
        message: toErrorMessage(error),
      };
    }
  }

  async createMonitorUser(
    actorId: bigint,
    actorRole: string | undefined,
    input: CreateMonitorUserBodyInput,
  ): Promise<MonitorUserCreateResult> {
    const actor = await this.validateActor(actorId, actorRole);
    if ("status" in actor && actor.status !== undefined) {
      return actor;
    }

    const existingAccount =
      await this.monitorUserRepository.findByAccountInsensitive(input.account);

    if (existingAccount) {
      return {
        status: 409,
        message: "Account already exists",
      };
    }

    const existingEmail =
      await this.monitorUserRepository.findMonitoringUserByEmail(input.email);

    if (existingEmail) {
      return {
        status: 409,
        message: "Email already exists",
      };
    }

    try {
      const passwordHash = await hashPassword(input.password);
      const created = await this.monitorUserRepository.createMonitoringUser({
        account: input.account,
        email: input.email,
        phone: input.phone,
        timezone: input.timezone,
        passwordHash,
        assignedById: actorId,
      });

      return {
        status: 201,
        message: "Monitor user created successfully.",
        data: {
          id: String(created.id),
          account: created.account,
          email: created.email,
          phone: created.phone,
          timezone: created.timezone,
          role: created.role,
          portal: created.portal,
          status: created.status,
          createdAt: created.createdAt.toISOString(),
        },
      };
    } catch (error: unknown) {
      return {
        status: 500,
        message: toErrorMessage(error),
      };
    }
  }

  async getDashboardSummary(actorId: bigint, actorRole: string | undefined) {
    const actor = await this.validateActor(actorId, actorRole);

    if ("status" in actor) {
      return actor;
    }

    const totals = await this.monitorUserRepository.getDashboardSummary(
      actorId,
      actor.role,
    );

    return {
      status: 200,
      message: "Dashboard summary fetched successfully",
      data: {
        currentPower: Number(totals.currentPower ?? 0),
        eToday: Number(totals.eToday ?? 0),
        eTotal: Number(totals.eTotal ?? 0),
      },
    };
  }
}
