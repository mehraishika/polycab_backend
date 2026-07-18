import { prisma, type PrismaClient } from "@/server/db/prisma";
import { Prisma } from "@/server/db/generated/prisma/client";

export class MonitorUserRepository {
  constructor(private readonly dbClient: PrismaClient = prisma) { }
  private async getLatestInverterTotals(serialNumbers?: string[]) {
    const filterClause =
      serialNumbers && serialNumbers.length > 0
        ? Prisma.sql`WHERE dll.sno IN (${Prisma.join(serialNumbers)})`
        : Prisma.empty;

    const result = await this.dbClient.$queryRaw<
      {
        currentPower: number | null;
        eToday: number | null;
        eTotal: number | null;
      }[]
    >`
		SELECT
			COALESCE(SUM(dll.current_power), 0) AS "currentPower",
			COALESCE(SUM(dll.daily_production), 0) AS "eToday",
			COALESCE(SUM(dll.total_energy), 0) AS "eTotal"
		FROM device_logs_latest dll
		INNER JOIN (
			SELECT sno, MAX(latest_timestamp) AS latest_timestamp
			FROM device_logs_latest
			GROUP BY sno
		) latest
			ON latest.sno = dll.sno
			AND latest.latest_timestamp = dll.latest_timestamp
		${filterClause}
	`;

    return (
      result[0] ?? {
        currentPower: 0,
        eToday: 0,
        eTotal: 0,
      }
    );
  }

  private async getScopedSerialNumbers(accounts: string[]) {
    const inverters = await this.dbClient.deviceInverter.findMany({
      where: {
        deletedAt: null,
        plant: {
          userAccount: {
            in: accounts,
          },
        },
      },
      select: {
        serialNumber: true,
      },
    });

    return inverters.map((item) => item.serialNumber);
  }

  // // Add this method anywhere inside the MonitorUserRepository class:
  // findUserIdsByAccounts(accounts: string[]) {
  //   return this.dbClient.user.findMany({
  //     where: {
  //       account: {
  //         in: accounts,
  //         mode: "insensitive",
  //       },
  //       portal: "monitoring",
  //       role: "monitoring_user",
  //       isDeleted: false,
  //       status: "active",
  //     },
  //     select: { id: true },
  //   });
  // }
  findActorById(actorId: bigint) {
    return this.dbClient.user.findUnique({
      where: { id: actorId },
      select: {
        id: true,
        account: true,
        role: true,
        portal: true,
        isDeleted: true,
      },
    });
  }

  findScopedMonitorUsers(actorId: bigint, actorRole?: string) {
    return this.dbClient.user.findMany({
      where: {
        portal: "monitoring",
        role: "monitoring_user",
        status: "active",
        isDeleted: false,

        ...(actorRole === "service_admin" ? { assignedById: actorId } : {}),
      },

      select: {
        id: true,
        account: true,
        email: true,
        phone: true,
        timezone: true,
        assignedById: true,
        updatedAt: true,
        createdAt: true,
      },
    });
  }
  // findScopedMonitorUsers(actorId: bigint) {
  // 	return this.dbClient.user.findMany({
  // 		where: {
  // 			portal: 'monitoring',
  // 			role: 'monitoring_user',
  // 			assignedById: actorId,
  // 			isDeleted: false,
  // 			status: 'active',
  // 		},
  // 		select: {
  // 			id: true,
  // 			account: true,
  // 			email: true,
  // 			phone: true,
  // 			// mobile: true,
  // 			timezone: true,
  // 			assignedById: true,
  // 			updatedAt: true,
  // 		},
  // 	});
  // }

  async getPlantStatusCountsForUsers(accounts: string[]) {
    const plants = await this.dbClient.plant.findMany({
      where: {
        userAccount: {
          in: accounts,
        },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    const plantIds = plants.map((p) => p.id);

    const counts = await this.dbClient.plantCurrentStatus.aggregate({
      where: {
        plantId: {
          in: plantIds,
        },
      },
      _sum: {
        totalDevices: true,
        normalCount: true,
        abnormalCount: true,
        standbyCount: true,
        offlineCount: true,
      },
    });

    return counts._sum;
  }

  async findPlantStatusesByPlantIds(plantIds: bigint[]) {
    return this.dbClient.plantCurrentStatus.findMany({
      where: {
        plantId: {
          in: plantIds,
        },
      },
      select: {
        plantId: true,
        totalDevices: true,
        normalCount: true,
        abnormalCount: true,
        standbyCount: true,
        offlineCount: true,
      },
    });
  }

  findScopedMonitorUsersByIds(
    actorId: bigint,
    actorRole: string | undefined,
    monitorUserIds: bigint[],
  ) {
    return this.dbClient.user.findMany({
      where: {
        id: { in: monitorUserIds },
        portal: "monitoring",
        role: "monitoring_user",
        ...(actorRole !== "service_super_admin"
          ? { assignedById: actorId }
          : {}),
        isDeleted: false,
        status: "active",
      },
      select: {
        id: true,
        account: true,
        email: true,
        phone: true,
        timezone: true,
        assignedById: true,
        updatedAt: true,
        createdAt: true,
      },
    });
  }

  findScopedMonitorUser(
    actorId: bigint,
    actorRole: string | undefined,
    monitorUserId: bigint,
  ) {
    return this.dbClient.user.findFirst({
      where: {
        id: monitorUserId,
        portal: "monitoring",
        role: "monitoring_user",
        ...(actorRole !== "service_super_admin"
          ? { assignedById: actorId }
          : {}),
        isDeleted: false,
        status: "active",
      },
      select: {
        id: true,
        account: true,
      },
    });
  }

  findPlantsByAccounts(accounts: string[]) {
    return this.dbClient.plant.findMany({
      where: {
        userAccount: {
          in: accounts,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        userAccount: true,
        installed: true,
        kwp: true,
        // powerValue: true,
        // eTodayValue: true,
        // eTotalValue: true,
        updatedAt: true,
      },
    });
  }

  findAssignersByIds(assignerIds: bigint[]) {
    return this.dbClient.user.findMany({
      where: {
        id: {
          in: assignerIds,
        },
      },
      select: {
        id: true,
        account: true,
      },
    });
  }

  findInvertersByPlantIds(plantIds: bigint[]) {
    return this.dbClient.deviceInverter.findMany({
      where: {
        plantId: {
          in: plantIds,
        },
        deletedAt: null,
      },
      select: {
        plantId: true,
        // online: true,
        // status: true,
        serialNumber: true,
      },
    });
  }

  async findLatestLogsBySerialNumbers(serialNumbers: string[]) {
    const latestPerInverter = await this.dbClient.deviceLogsLatest.groupBy({
      by: ["sno"],

      where: {
        sno: {
          in: serialNumbers,
        },
      },

      _max: {
        latestTimestamp: true,
      },
    });

    const latestConditions = latestPerInverter
      .filter((item) => item._max.latestTimestamp)
      .map((item) => ({
        sno: item.sno,
        latestTimestamp: item._max.latestTimestamp!,
      }));

    if (!latestConditions.length) {
      return [];
    }

    return this.dbClient.deviceLogsLatest.findMany({
      where: {
        OR: latestConditions,
      },

      select: {
        sno: true,
        currentPower: true,
        dailyProduction: true,
        totalEnergy: true,
        latestTimestamp: true,
      },
    });
  }

  findDataloggersByPlantIds(plantIds: bigint[]) {
    return this.dbClient.deviceDatalogger.findMany({
      where: {
        plantId: {
          in: plantIds,
        },
        deletedAt: null,
      },
      select: {
        plantId: true,
        online: true,
        status: true,
        serialNumber: true,
      },
    });
  }

  countPlantsByUserAccount(userAccount: string) {
    return this.dbClient.plant.count({
      where: {
        userAccount,
        deletedAt: null,
      },
    });
  }

  findPlantsByUserAccount(userAccount: string, page: number, pageSize: number) {
    return this.dbClient.plant.findMany({
      where: {
        userAccount,
        deletedAt: null,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        installed: true,
      },
    });
  }

  findTargetServiceUser(targetUserId: bigint) {
    return this.dbClient.user.findFirst({
      where: {
        id: targetUserId,
        portal: "service",
        role: {
          in: ["service_admin", "service_super_admin"],
        },
        isDeleted: false,
      },
      select: {
        id: true,
        assignedById: true,
      },
    });
  }

  findScopedMonitorUserIds(
    actorId: bigint,
    actorRole: string | undefined,
    monitorUserIds: bigint[],
  ) {
    return this.dbClient.user.findMany({
      where: {
        id: {
          in: monitorUserIds,
        },
        portal: "monitoring",
        role: "monitoring_user",
        ...(actorRole !== "service_super_admin"
          ? { assignedById: actorId }
          : {}),
        isDeleted: false,
        status: "active",
      },
      select: {
        id: true,
      },
    });
  }

  updateMonitorUsersAssignedBy(
    actorId: bigint,
    actorRole: string | undefined,
    monitorUserIds: bigint[],
    targetUserId: bigint,
  ) {
    return this.dbClient.user.updateMany({
      where: {
        id: {
          in: monitorUserIds,
        },
        portal: 'monitoring',
        role: 'monitoring_user',
        ...(actorRole !== 'service_super_admin'
          ? { assignedById: actorId }
          : {}),
        isDeleted: false,
        status: 'active',
      },
      data: {
        assignedById: targetUserId,
      },
    });
  }

  async findMonitorUserByAccount(account: string) {
    return this.dbClient.user.findFirst({
      where: {
        account,
        portal: 'monitoring',
        role: 'monitoring_user',
        isDeleted: false,
        status: 'active',
      },
      select: {
        id: true,
        account: true,
      },
    });
  }

  async findMappingBySerialNumber(serialNumber: string) {
    return this.dbClient.userPlantInverterMap.findFirst({
      where: {
        serialNumber,
        isDeleted: false,
      },
    });
  }

  async createUserPlantMapping(
    userId: bigint,
    serialNumber: string,
  ) {
    return this.dbClient.userPlantInverterMap.create({
      data: {
        userId,
        plantId: null,
        serialNumber,
      },
    });
  }

  findByAccountInsensitive(account: string) {
    return this.dbClient.user.findFirst({
      where: {
        account: {
          equals: account,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });
  }

  findUserIdsByAccounts(accounts: string[]) {
    return this.dbClient.user.findMany({
      where: {
        account: {
          in: accounts,
          mode: "insensitive",
        },
        portal: "monitoring",
        role: "monitoring_user",
        isDeleted: false,
        status: "active",
      },
      select: { id: true },
    });
  }

  findMonitoringUserByEmail(email: string) {
    return this.dbClient.user.findFirst({
      where: {
        portal: "monitoring",
        email: {
          equals: email,
          mode: "insensitive",
        },
        isDeleted: false,
      },
      select: { id: true },
    });
  }

  createMonitoringUser(input: {
    account: string;
    email: string;
    phone: string;
    timezone: string;
    passwordHash: string;
    assignedById: bigint;
  }) {
    return this.dbClient.user.create({
      data: {
        account: input.account,
        email: input.email,
        phone: input.phone,
        // mobile: input.phone.slice(0, 10),
        timezone: input.timezone,
        passwordHash: input.passwordHash,
        portal: "monitoring",
        role: "monitoring_user",
        status: "active",
        assignedById: input.assignedById,
      },
      select: {
        id: true,
        account: true,
        email: true,
        phone: true,
        timezone: true,
        role: true,
        portal: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async getDashboardSummary(actorId: bigint, role: string) {
    if (role === "service_super_admin") {
      return this.getLatestInverterTotals();
    }

    const assignedUsers = await this.dbClient.user.findMany({
      where: {
        assignedById: actorId,
        isDeleted: false,
      },
      select: {
        account: true,
      },
    });

    const accounts = assignedUsers.map((u) => u.account);

    const serialNumbers = await this.getScopedSerialNumbers(accounts);

    return this.getLatestInverterTotals(serialNumbers);
  }
}
