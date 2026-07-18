import { prisma, type PrismaClient } from "@/server/db/prisma";
import type {
  UserListQueryInput,
  UserRoleType,
  CreateSubUserInput,
  ServiceAdminEditInput,
  ServiceAdminUserListInput,
} from "@/server/validators/user.validator";
import { UserRole } from "../db/generated/prisma/client";
import { DeviceLatestRecord } from "../services/user.service";

export interface UserDeleteRecord {
  id: bigint;
  isDeleted: boolean;
}

export interface UserDetailRecord {
  id: bigint;
  account: string;
  email: string | null;
  portal: string;
  role: string;
  status: string;
  timezone: string | null;
  phone: string | null;
  address: string | null;
  assignedById: bigint | null;
  isDeleted: boolean;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface UserListResult {
  total: number;
  items: UserDetailRecord[];
}

export interface ServiceAdminListResult {
  totalItems: number;
  items: UserDetailRecord[];
}

export interface ActorAccessRecord {
  id: bigint;
  portal: string;
  role: string;
  isDeleted: boolean;
}

export class UserRepository {
  constructor(private readonly dbClient: PrismaClient = prisma) { }

  private buildWhere(roleType: UserRoleType, filters: UserListQueryInput) {
    const where: Record<string, unknown> = {};

    if (roleType !== "all") {
      where.role = roleType;
    }

    where.isDeleted = filters.isDeleted ?? false;

    if (filters.portal) {
      where.portal = filters.portal;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.account) {
      where.account = {
        contains: filters.account,
        mode: "insensitive",
      };
    }

    if (filters.email) {
      where.email = {
        contains: filters.email,
        mode: "insensitive",
      };
    }

    if (filters.phone) {
      where.phone = {
        contains: filters.phone,
        mode: "insensitive",
      };
    }

    if (filters.search) {
      where.OR = [
        {
          account: {
            contains: filters.search,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: filters.search,
            mode: "insensitive",
          },
        },
        {
          phone: {
            contains: filters.search,
            mode: "insensitive",
          },
        },
      ];
    }

    return where;
  }

  private mapDetailRecord(record: {
    id: bigint;
    account: string;
    email: string | null;
    portal: string;
    role: string;
    status: string;
    timezone: string | null;
    phone: string | null;
    address: string | null;
    assignedById: bigint | null;
    isDeleted: boolean;
    emailVerifiedAt: Date | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): UserDetailRecord {
    return {
      id: record.id,
      account: record.account,
      email: record.email,
      portal: record.portal,
      role: record.role,
      status: record.status,
      timezone: record.timezone,
      phone: record.phone,
      address: record.address,
      assignedById: record.assignedById,
      isDeleted: record.isDeleted,
      emailVerifiedAt: record.emailVerifiedAt,
      lastLoginAt: record.lastLoginAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    };
  }
  async findMonitoringUserByAccount(
    account: string,
  ): Promise<UserDetailRecord | null> {
    const user = await this.dbClient.user.findFirst({
      where: {
        account,
        role: UserRole.monitoring_user,
        isDeleted: false,
      },
      select: {
        id: true,
        account: true,
        email: true,
        portal: true,
        role: true,
        status: true,
        timezone: true,
        phone: true,
        address: true,
        assignedById: true,
        isDeleted: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    return user ? this.mapDetailRecord(user) : null;
  }

  async findLatestDeviceBySN(
    sno: string,
    plantId?: string | bigint,
  ): Promise<DeviceLatestRecord | null> {
    const mappingWhere: Record<string, unknown> = {
      serialNumber: sno,
      isDeleted: false,
    };

    if (plantId !== undefined) {
      mappingWhere.plantId = BigInt(plantId);
    }

    const mapping = await this.dbClient.userPlantInverterMap.findFirst({
      where: mappingWhere,
      select: {
        plantId: true,
        userId: true,
        user: {
          select: {
            account: true,
          },
        },
      },
    });

    if (!mapping) {
      return null;
    }

    const device = await this.dbClient.deviceLogsLatest.findFirst({
      where: {
        sno,
      },
      orderBy: {
        latestTimestamp: "desc",
      },
      select: {
        id: true,
        sno: true,
        inverterName: true,
        dayDate: true,
        latestTimestamp: true,
        dailyProduction: true,
        totalEnergy: true,
        totalHours: true,
        currentPower: true,
        sourceLog: {
          select: {
            logger_status: true,
            module_version_no: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!device) {
      return null;
    }

    const currentStatus = await this.dbClient.deviceCurrentStatus.findUnique({
      where: {
        sno,
      },
      select: {
        status: true,
      },
    });

    const userMapping = await this.dbClient.userPlantInverterMap.findFirst({
      where: {
        serialNumber: sno,
        isDeleted: false,
      },
      select: {
        userId: true,
        user: {
          select: {
            account: true,
          },
        },
      },
    });

    return {
      id: device.id,
      sno: device.sno,
      inverterName: device.inverterName,
      dayDate: device.dayDate,
      latestTimestamp: device.latestTimestamp,
      dailyProduction: device.dailyProduction,
      totalEnergy: device.totalEnergy,
      totalHours: device.totalHours,
      currentPower: device.currentPower,
      logger_status: device.sourceLog?.logger_status ?? null,
      module_version_no: device.sourceLog?.module_version_no ?? null,
      communicationStatus: device.sourceLog?.logger_status ?? null,
      communicationModuleVersion: device.sourceLog?.module_version_no ?? null,
      communicationModuleSn: device.sno,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
      plantId: mapping.plantId?.toString() ?? null,
      status: currentStatus?.status ?? "Offline",
      userId: userMapping?.userId?.toString() ?? null,
      account: userMapping?.user.account ?? null,
    };
  }

  async updateProfile(
    userId: bigint,
    payload: {
      email?: string;
      phone?: string | null;
      address?: string | null;
      timezone?: string | null;
    },
  ) {
    return this.dbClient.user.update({
      where: {
        id: userId,
      },
      data: {
        email: payload.email,
        phone: payload.phone ?? null,
        address: payload.address ?? null,
        timezone: payload.timezone ?? null,
      },
      select: {
        account: true,
        email: true,
        phone: true,
        address: true,
        timezone: true,
        updatedAt: true,
      },
    });
  }

  async getProfile(userId: bigint) {
    return this.dbClient.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        account: true,
        email: true,
        phone: true,
        address: true,
        timezone: true,
      },
    });
  }
  async getAccountScopeByUserId(
    userId: string | bigint,
  ): Promise<string[] | null> {
    const user = await this.dbClient.user.findUnique({
      where: {
        id: BigInt(userId),
      },
      select: {
        account: true,
      },
    });

    return user ? [user.account] : null;
  }
  async findByPortalAndAccount(
    portal: string,
    account: string,
  ): Promise<{ id: bigint } | null> {
    const record = await this.dbClient.user.findFirst({
      where: {
        portal: portal as "monitoring" | "service",
        account: {
          equals: account,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    return record ?? null;
  }

  async findByPortalAndEmail(
    portal: string,
    email: string,
  ): Promise<{ id: bigint } | null> {
    const record = await this.dbClient.user.findFirst({
      where: {
        portal: portal as "monitoring" | "service",
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    return record ?? null;
  }

  async findById(id: bigint): Promise<UserDeleteRecord | null> {
    const record = await this.dbClient.user.findUnique({
      where: { id },
      select: {
        id: true,
        isDeleted: true,
      },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      isDeleted: record.isDeleted,
    };
  }

  async findDetailById(id: bigint): Promise<UserDetailRecord | null> {
    const record = await this.dbClient.user.findUnique({
      where: { id },
      select: {
        id: true,
        account: true,
        email: true,
        portal: true,
        role: true,
        status: true,
        timezone: true,
        phone: true,
        address: true,
        assignedById: true,
        isDeleted: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!record) {
      return null;
    }

    return this.mapDetailRecord(record);
  }

  async listByRole(
    roleType: UserRoleType,
    filters: UserListQueryInput,
  ): Promise<UserListResult> {
    const where = this.buildWhere(roleType, filters);
    const page = filters.page;
    const limit = filters.limit;
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      this.dbClient.user.count({ where }),
      this.dbClient.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          account: true,
          email: true,
          portal: true,
          role: true,
          status: true,
          timezone: true,
          phone: true,
          address: true,
          assignedById: true,
          isDeleted: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      }),
    ]);

    return {
      total,
      items: records.map((record) => this.mapDetailRecord(record)),
    };
  }

  async softDeleteById(id: bigint): Promise<boolean> {
    const user = await this.dbClient.user.findUnique({
      where: { id },
      select: {
        account: true,
        email: true,
      },
    });

    console.log("user", user);

    if (!user) {
      return false;
    }
    const result = await this.dbClient.user.updateMany({
      where: {
        id,
        isDeleted: false,
      },
      data: {
        account: `${user.account}_deleted`,
        email: `${user.email}_deleted`,
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return result.count > 0;
  }

  async createServiceUser(input: {
    account: string;
    email: string;
    timezone: string;
    passwordHash: string;
    role: CreateSubUserInput["role"];
    phone: string;
    assignedById: bigint;
  }): Promise<UserDetailRecord> {
    const record = await this.dbClient.user.create({
      data: {
        portal: "service",
        role: input.role,
        account: input.account,
        email: input.email,
        timezone: input.timezone,
        passwordHash: input.passwordHash,
        phone: input.phone,
        assignedById: input.assignedById,
      },
      select: {
        id: true,
        account: true,
        email: true,
        portal: true,
        role: true,
        status: true,
        timezone: true,
        phone: true,
        address: true,
        assignedById: true,
        isDeleted: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    return this.mapDetailRecord(record);
  }

  async findActorById(id: bigint): Promise<ActorAccessRecord | null> {
    const record = await this.dbClient.user.findUnique({
      where: { id },
      select: {
        id: true,
        portal: true,
        role: true,
        isDeleted: true,
      },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      portal: record.portal,
      role: record.role,
      isDeleted: record.isDeleted,
    };
  }

  async listScopedServiceAdmins(
    assignedById: bigint,
    filters: ServiceAdminUserListInput,
  ): Promise<ServiceAdminListResult> {
    const where: Record<string, unknown> = {
      portal: "service",
      role: "service_admin",
      assignedById,
      isDeleted: filters.includeDeleted,
    };

    if (filters.search.length > 0) {
      where.OR = [
        {
          account: {
            contains: filters.search,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: filters.search,
            mode: "insensitive",
          },
        },
        {
          phone: {
            contains: filters.search,
            mode: "insensitive",
          },
        },
      ];
    }

    const skip = (filters.page - 1) * filters.pageSize;

    const [totalItems, records] = await Promise.all([
      this.dbClient.user.count({ where }),
      this.dbClient.user.findMany({
        where,
        skip,
        take: filters.pageSize,
        orderBy: {
          [filters.sortBy]: filters.sortOrder,
        },
        select: {
          id: true,
          account: true,
          email: true,
          portal: true,
          role: true,
          status: true,
          timezone: true,
          phone: true,
          address: true,
          assignedById: true,
          isDeleted: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      }),
    ]);

    return {
      totalItems,
      items: records.map((record) => this.mapDetailRecord(record)),
    };
  }

  async findScopedServiceAdminById(
    id: bigint,
    assignedById: bigint,
  ): Promise<UserDetailRecord | null> {
    const record = await this.dbClient.user.findFirst({
      where: {
        id,
        portal: "service",
        role: "service_admin",
        assignedById,
      },
      select: {
        id: true,
        account: true,
        email: true,
        portal: true,
        role: true,
        status: true,
        timezone: true,
        phone: true,
        address: true,
        assignedById: true,
        isDeleted: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!record) {
      return null;
    }

    return this.mapDetailRecord(record);
  }

  async findScopedServiceAdmins(
    actorId: bigint,
    actorRole: string | undefined,
  ) {
    const where: any = {
      role: "service_admin",
      isDeleted: false,
    };

    // Service Admin should only see themselves
    if (actorRole === "service_admin") {
      where.id = actorId;
    }

    return this.dbClient.user.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findServiceAdminByEmailExcludingId(
    email: string,
    excludeId: bigint,
  ): Promise<{ id: bigint } | null> {
    const record = await this.dbClient.user.findFirst({
      where: {
        portal: "service",
        email: {
          equals: email,
          mode: "insensitive",
        },
        id: {
          not: excludeId,
        },
        isDeleted: false,
      },
      select: { id: true },
    });

    return record ?? null;
  }

  async updateScopedServiceAdminById(
    id: bigint,
    assignedById: bigint,
    input: ServiceAdminEditInput,
    passwordHash?: string,
  ): Promise<UserDetailRecord | null> {
    const data: Record<string, unknown> = {
      phone: input.phone,
      email: input.email,
      timezone: input.timezone,
    };

    if (passwordHash) {
      data.passwordHash = passwordHash;
    }

    const updated = await this.dbClient.user.updateManyAndReturn({
      where: {
        id,
        portal: "service",
        role: "service_admin",
        assignedById,
        isDeleted: false,
      },
      data,
      select: {
        id: true,
        account: true,
        email: true,
        portal: true,
        role: true,
        status: true,
        timezone: true,
        phone: true,
        address: true,
        assignedById: true,
        isDeleted: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (updated.length === 0) {
      return null;
    }

    return this.mapDetailRecord(updated[0]);
  }

  async softDeleteScopedServiceAdminById(
    id: bigint,
    assignedById: bigint,
  ): Promise<UserDetailRecord | null> {
    const deleted = await this.dbClient.user.updateManyAndReturn({
      where: {
        id,
        portal: "service",
        role: "service_admin",
        assignedById,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
      select: {
        id: true,
        account: true,
        email: true,
        portal: true,
        role: true,
        status: true,
        timezone: true,
        phone: true,
        address: true,
        assignedById: true,
        isDeleted: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (deleted.length === 0) {
      return null;
    }

    return this.mapDetailRecord(deleted[0]);
  }

  async getDeviceCountsByAccounts(
    accounts: string[],
  ): Promise<Map<string, number>> {
    if (accounts.length === 0) {
      return new Map<string, number>();
    }

    // Initialize result map
    const deviceCountByAccount = new Map<string, number>();
    for (const account of accounts) {
      deviceCountByAccount.set(account, 0);
    }

    // Step 1: Get service admins
    const serviceAdmins = await this.dbClient.user.findMany({
      where: {
        account: {
          in: accounts,
        },
        isDeleted: false,
      },
      select: {
        id: true,
        account: true,
      },
    });

    if (serviceAdmins.length === 0) {
      return deviceCountByAccount;
    }

    const adminIds = serviceAdmins.map((a) => a.id);

    const adminAccountById = new Map<string, string>();
    for (const admin of serviceAdmins) {
      adminAccountById.set(String(admin.id), admin.account);
    }

    // Step 2: Get end users assigned to those admins
    const endUsers = await this.dbClient.user.findMany({
      where: {
        assignedById: {
          in: adminIds,
        },
        isDeleted: false,
      },
      select: {
        account: true,
        assignedById: true,
      },
    });

    if (endUsers.length === 0) {
      return deviceCountByAccount;
    }

    // admin account -> end user accounts
    const endUsersByAdmin = new Map<string, string[]>();

    for (const endUser of endUsers) {
      if (!endUser.assignedById) continue;

      const adminAccount = adminAccountById.get(
        String(endUser.assignedById),
      );

      if (!adminAccount) continue;

      const users = endUsersByAdmin.get(adminAccount) ?? [];
      users.push(endUser.account);
      endUsersByAdmin.set(adminAccount, users);
    }

    const endUserAccounts = endUsers.map((u) => u.account);

    // Step 3: Get plants of end users
    const plants = await this.dbClient.plant.findMany({
      where: {
        userAccount: {
          in: endUserAccounts,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        userAccount: true,
      },
    });

    if (plants.length === 0) {
      return deviceCountByAccount;
    }

    const plantIds = plants.map((p) => p.id);

    // plantId -> service admin account
    const adminByPlantId = new Map<string, string>();

    for (const plant of plants) {
      for (const [adminAccount, users] of endUsersByAdmin) {
        if (users.includes(plant.userAccount)) {
          adminByPlantId.set(String(plant.id), adminAccount);
          break;
        }
      }
    }

    // Step 4: Count devices
    const [inverterCounts, dataloggerCounts] = await Promise.all([
      this.dbClient.deviceInverter.groupBy({
        by: ["plantId"],
        where: {
          plantId: {
            in: plantIds,
          },
          deletedAt: null,
        },
        _count: {
          _all: true,
        },
      }),

      this.dbClient.deviceDatalogger.groupBy({
        by: ["plantId"],
        where: {
          plantId: {
            in: plantIds,
          },
          deletedAt: null,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    // Add inverter count
    for (const item of inverterCounts) {
      const adminAccount = adminByPlantId.get(String(item.plantId));

      if (!adminAccount) continue;

      const current = deviceCountByAccount.get(adminAccount) ?? 0;
      deviceCountByAccount.set(
        adminAccount,
        current + item._count._all,
      );
    }

    // Add datalogger count
    for (const item of dataloggerCounts) {
      const adminAccount = adminByPlantId.get(String(item.plantId));

      if (!adminAccount) continue;

      const current = deviceCountByAccount.get(adminAccount) ?? 0;
      deviceCountByAccount.set(
        adminAccount,
        current + item._count._all,
      );
    }

    return deviceCountByAccount;
  }

  async findPasswordById(id: bigint) {
    return prisma.user.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        passwordHash: true,
        isDeleted: true,
      },
    });
  }

  async updatePassword(id: bigint, passwordHash: string) {
    return prisma.user.update({
      where: {
        id,
      },
      data: {
        passwordHash,
      },
    });
  }

  async findPasswordByAccount(account: string) {
    return this.dbClient.user.findFirst({
      where: {
        account,
      },
      select: {
        id: true,
        isDeleted: true,
        passwordHash: true,
      },
    });
  }
}
