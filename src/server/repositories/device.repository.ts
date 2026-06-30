import { prisma, type PrismaClient } from "@/server/db/prisma";
import { ApiError } from "@/server/utils/api-error";

export interface DeviceListParams {
  scope: string[];
  plantId: string;
  page: number;
  pageSize: number;
  sortBy: "name" | "type" | "sn" | "power" | "today" | "total" | "hours";
  sortOrder: "asc" | "desc";
}

export interface DeviceLiveRowsParams {
  scope: string[];
  plantId: string;
  deviceIds: string[];
}

export interface AddPlantInverterParams {
  scope: string[];
  plantId: string;
  serialNumber: string;
  // type: string;
}

export interface DeviceViewParams {
  scope: string[];
  plantId: string;
  deviceId: string;
}

export interface DeviceEditParams {
  scope: string[];
  plantId: string;
  deviceId: string;
  name: string;
}

export interface DeviceDeleteParams {
  scope: string[];
  plantId: string;
  deviceId: string;
  reason?: string;
}

export interface DeviceChartContextParams {
  plantId: string;
  deviceId: string;
}

export interface DeviceChartSnapshot {
  plantId: bigint;
  plantAccount: string;
  device: {
    id: bigint;
    name: string;
    type: string;
    sn: string;
    // powerValue: number;
    // eTodayValue: number;
    // eTotalValue: number;
    // hTotalValue: number;
    updatedAt: Date;
  };
}

export interface DeviceCurrentAlertsSnapshotParams {
  plantId: string;
  deviceId: string;
}

export interface DeviceCurrentAlertsSnapshot {
  plantId: bigint;
  plantAccount: string;
  device: {
    id: bigint;
    name: string;
    type: string;
    sn: string;
    // online: boolean;
    // status: string | null;
    updatedAt: Date;
  };
}

export interface DeviceInformationSnapshotParams {
  plantId: string;
  deviceId: string;
}

export interface DeviceInformationSnapshot {
  plantId: bigint;
  plantAccount: string;
  device: {
    id: bigint;
    name: string;
    type: string;
    sn: string;
    // status: string | null;
    // online: boolean;
    // powerValue: number;
    // eTodayValue: number;
    // eTotalValue: number;
    // hTotalValue: number;
    updatedAt: Date;
    communicationModuleSn: string;
  };
}

type DeviceRow = {
  id: string;
  name: string;
  type: string;
  sn: string;
  power: { value: number; unit: "kW" };
  today: { value: number; unit: "kWh" };
  total: { value: number; unit: "kWh" };
  hours: { value: number; unit: "h" };
  online: boolean;
  updatedAt: string;
};

export class DeviceRepository {
  constructor(private readonly dbClient: PrismaClient = prisma) {}

  private formatDateTime(value: Date | null | undefined): string {
    const date = value ?? new Date();

    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(date)
      .replace(",", "");
  }

  private parseDeviceId(deviceId: string): bigint {
    const normalized = deviceId.startsWith("device-")
      ? deviceId.slice("device-".length)
      : deviceId;
    if (!/^\d+$/.test(normalized)) {
      throw new ApiError(400, "Invalid device id");
    }
    return BigInt(normalized);
  }

  private async getScopedPlantOrThrow(scope: string[], plantId: string) {
    if (!scope || scope.length === 0) {
      throw new ApiError(403, "Unauthorized access to plant devices");
    }

    const plant = await this.dbClient.plant.findFirst({
      where: { id: BigInt(plantId), deletedAt: null },
      select: { id: true, userAccount: true },
    });

    if (!plant) {
      throw new ApiError(404, "Plant not found");
    }

    if (!scope.includes(plant.userAccount)) {
      throw new ApiError(403, "You do not have access to this plant");
    }

    return plant;
  }

  private parsePlantId(plantId: string): bigint {
    if (!/^\d+$/.test(plantId)) {
      throw new ApiError(400, "Invalid plant id");
    }

    return BigInt(plantId);
  }

  private mapDeviceRows(devices: Array<any>): DeviceRow[] {
    return devices.map((device) => ({
      id: `device-${String(device.id)}`,
      name: device.name ?? `${device.type} ${device.serialNumber}`,
      type: device.type,
      sn: device.serialNumber,
      power: { value: Number((device.powerValue ?? 0).toFixed(2)), unit: "kW" },
      today: {
        value: Number((device.eTodayValue ?? 0).toFixed(2)),
        unit: "kWh",
      },
      total: {
        value: Number((device.eTotalValue ?? 0).toFixed(2)),
        unit: "kWh",
      },
      hours: { value: Number((device.hTotalValue ?? 0).toFixed(2)), unit: "h" },
      online:
        device.status?.toLowerCase() === "online"
          ? true
          : Boolean(device.online),
      status: device.status ?? "offline",
      updatedAt: this.formatDateTime(
        device.updatedAt ?? device.updateTime ?? device.createdAt,
      ),
    }));
  }

  private sortRows(
    rows: DeviceRow[],
    sortBy: DeviceListParams["sortBy"],
    sortOrder: DeviceListParams["sortOrder"],
  ) {
    const multiplier = sortOrder === "asc" ? 1 : -1;
    return rows.sort((left, right) => {
      if (sortBy === "power")
        return (left.power.value - right.power.value) * multiplier;
      if (sortBy === "today")
        return (left.today.value - right.today.value) * multiplier;
      if (sortBy === "total")
        return (left.total.value - right.total.value) * multiplier;
      if (sortBy === "hours")
        return (left.hours.value - right.hours.value) * multiplier;
      if (sortBy === "type")
        return left.type.localeCompare(right.type) * multiplier;
      if (sortBy === "sn") return left.sn.localeCompare(right.sn) * multiplier;
      return left.name.localeCompare(right.name) * multiplier;
    });
  }

  // 	async getPlantDeviceList(params: DeviceListParams) {
  // 		await this.getScopedPlantOrThrow(params.scope, params.plantId);

  // 		const [inverters, dataloggers] = await Promise.all([
  // 			this.dbClient.deviceInverter.findMany({
  // 				where: { plantId: BigInt(params.plantId), deletedAt: null },
  // 				select: {
  // 					id: true,
  // 					name: true,
  // 					type: true,
  // 					serialNumber: true,
  // 					// powerValue: true,
  // 					// eTodayValue: true,
  // 					// eTotalValue: true,
  // 					// hTotalValue: true,
  // 					// online: true,
  // 					updatedAt: true,
  // 					updateTime: true,
  // 					createdAt: true,
  // 				},
  // 			}),
  // 			this.dbClient.deviceDatalogger.findMany({
  // 				where: { plantId: BigInt(params.plantId), deletedAt: null },
  // 				select: {
  // 					id: true,
  // 					name: true,
  // 					type: true,
  // 					serialNumber: true,
  // 					online: true,
  // 					updatedAt: true,
  // 					updateTime: true,
  // 					createdAt: true,
  // 				},
  // 			}),
  // 		]);

  // 		const serialNumbers = inverters.map(i => i.serialNumber);

  // 		const latestLogs = await this.dbClient.deviceLogsLatest.findMany({
  // 			where: {
  // 				sno: {
  // 					in: serialNumbers,
  // 				},
  // 			},
  // 			select: {
  // 				sno: true,
  // 				currentPower: true,
  // 				dailyProduction: true,
  // 				totalEnergy: true,
  // 				totalHours: true,
  // 			},
  // 		});

  // 		const latestMap = new Map(
  // 			latestLogs.map(log => [log.sno, log])
  // 		);

  // 		const enrichedInverters = inverters.map(inverter => {
  // 			const latest = latestMap.get(inverter.serialNumber);

  // 			return {
  // 				...inverter,

  // 				powerValue: latest?.currentPower ?? 0,

  // 				eTodayValue: latest?.dailyProduction ?? 0,

  // 				eTotalValue: latest?.totalEnergy ?? 0,

  // 				hTotalValue: latest?.totalHours ?? 0,
  // 			};
  // 		});

  // 		// const rows = this.sortRows([...this.mapDeviceRows(inverters), ...this.mapDeviceRows(dataloggers)], params.sortBy, params.sortOrder);
  // 		const rows = this.sortRows(
  // 			[
  // 				...this.mapDeviceRows(enrichedInverters),
  // 				...this.mapDeviceRows(dataloggers),
  // 			],
  // 			params.sortBy,
  // 			params.sortOrder
  // 		);
  // 		const totalItems = rows.length;
  // 		const totalPages = totalItems > 0 ? Math.ceil(totalItems / params.pageSize) : 0;
  // 		const safePage = totalPages > 0 ? Math.min(params.page, totalPages) : 1;
  // 		const start = (safePage - 1) * params.pageSize;

  // 		return {
  // 			items: rows.slice(start, start + params.pageSize),
  // 			pagination: {
  // 				page: totalItems > 0 ? safePage : 1,
  // 				pageSize: params.pageSize,
  // 				totalItems,
  // 				totalPages,
  // 			},
  // 		};
  // 	}

  async getPlantDeviceList(params: DeviceListParams) {
    await this.getScopedPlantOrThrow(params.scope, params.plantId);

    const [inverters, dataloggers] = await Promise.all([
      this.dbClient.deviceInverter.findMany({
        where: { plantId: BigInt(params.plantId), deletedAt: null },
        select: {
          id: true,
          name: true,
          type: true,
          serialNumber: true,
          updatedAt: true,
          updateTime: true,
          createdAt: true,
        },
      }),
      this.dbClient.deviceDatalogger.findMany({
        where: { plantId: BigInt(params.plantId), deletedAt: null },
        select: {
          id: true,
          name: true,
          type: true,
          serialNumber: true,
          online: true,
          updatedAt: true,
          updateTime: true,
          createdAt: true,
        },
      }),
    ]);

    const serialNumbers = inverters.map((i) => i.serialNumber);

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

    const [latestLogs, connectionStatuses] = await Promise.all([
      this.dbClient.deviceLogsLatest.findMany({
        where: {
          OR: latestConditions,
        },

        select: {
          sno: true,
          currentPower: true,
          dailyProduction: true,
          totalEnergy: true,
          totalHours: true,
          latestTimestamp: true,
        },
      }),

      this.dbClient.deviceConnectionStatus.findMany({
        where: {
          serialNumber: {
            in: serialNumbers,
          },
        },

        select: {
          serialNumber: true,
          status: true,
        },
      }),
    ]);

    const latestMap = new Map(latestLogs.map((log) => [log.sno, log]));

    const statusMap = new Map(
      connectionStatuses.map((item) => [item.serialNumber, item.status]),
    );

    const enrichedInverters = inverters.map((inverter) => {
      const latest = latestMap.get(inverter.serialNumber);

      return {
        ...inverter,
        powerValue: latest?.currentPower ?? 0,
        eTodayValue: latest?.dailyProduction ?? 0,

        eTotalValue: latest?.totalEnergy ?? 0,

        hTotalValue: latest?.totalHours ?? 0,

        status: statusMap.get(inverter.serialNumber) ?? "offline",
      };
    });

    const rows = this.sortRows(
      [
        ...this.mapDeviceRows(enrichedInverters),
        ...this.mapDeviceRows(dataloggers),
      ],
      params.sortBy,
      params.sortOrder,
    );

    const totalItems = rows.length;
    const totalPages =
      totalItems > 0 ? Math.ceil(totalItems / params.pageSize) : 0;

    const safePage = totalPages > 0 ? Math.min(params.page, totalPages) : 1;

    const start = (safePage - 1) * params.pageSize;

    return {
      items: rows.slice(start, start + params.pageSize),
      pagination: {
        page: totalItems > 0 ? safePage : 1,
        pageSize: params.pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  async getPlantDeviceLiveRows(params: DeviceLiveRowsParams) {
    await this.getScopedPlantOrThrow(params.scope, params.plantId);
    const deviceIds = params.deviceIds.map((id) => this.parseDeviceId(id));

    const [inverters, dataloggers] = await Promise.all([
      this.dbClient.deviceInverter.findMany({
        where: {
          id: { in: deviceIds },
          plantId: BigInt(params.plantId),
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          type: true,
          serialNumber: true,
          // powerValue: true,
          // eTodayValue: true,
          // eTotalValue: true,
          // hTotalValue: true,
          // online: true,
          updatedAt: true,
          updateTime: true,
          createdAt: true,
        },
      }),
      this.dbClient.deviceDatalogger.findMany({
        where: {
          id: { in: deviceIds },
          plantId: BigInt(params.plantId),
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          type: true,
          serialNumber: true,
          online: true,
          updatedAt: true,
          updateTime: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      items: [
        ...this.mapDeviceRows(inverters),
        ...this.mapDeviceRows(dataloggers),
      ],
    };
  }

  // async addPlantInverter(params: AddPlantInverterParams) {
  // 	await this.getScopedPlantOrThrow(params.scope, params.plantId);
  // 	const created = await this.dbClient.deviceInverter.create({
  // 		data: {
  // 			plantId: BigInt(params.plantId),
  // 			serialNumber: params.serialNumber,
  // 			type: params.type,
  // 			name: `${params.type} ${params.serialNumber}`,
  // 			// online: false,
  // 			// status: 'offline',
  // 		},
  // 		select: { id: true },
  // 	});

  // 	return { deviceId: `device-${String(created.id)}` };
  // }

  async addPlantInverter(params: AddPlantInverterParams) {
    await this.getScopedPlantOrThrow(params.scope, params.plantId);

    const user = await this.dbClient.user.findUnique({
      where: {
        account: params.scope[0], // or wherever username exists
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const latestDevice = await this.dbClient.deviceLogsLatest.findFirst({
      where: {
        sno: params.serialNumber,
      },
      select: {
        inverterName: true,
      },
    });

    const type = latestDevice?.inverterName ?? undefined;

    const created = await this.dbClient.deviceInverter.create({
      data: {
        plantId: BigInt(params.plantId),
        serialNumber: params.serialNumber,

        type,

        name: type ? `${type} ${params.serialNumber}` : params.serialNumber,
      },
      select: {
        id: true,
      },
    });

    // create mapping entry
    await this.dbClient.userPlantInverterMap.create({
      data: {
        userId: BigInt(user.id),
        plantId: BigInt(params.plantId),
        serialNumber: params.serialNumber,
        isDeleted: false,
      },
    });

    return { deviceId: `device-${String(created.id)}` };
  }

  // async getDeviceView(params: DeviceViewParams) {
  // 	await this.getScopedPlantOrThrow(params.scope, params.plantId);
  // 	const deviceId = this.parseDeviceId(params.deviceId);

  // 	const inverter = await this.dbClient.deviceInverter.findFirst({
  // 		where: { id: deviceId, plantId: BigInt(params.plantId), deletedAt: null },
  // 		select: { id: true, name: true, type: true, serialNumber: true },
  // 	});
  // 	// const inverter = await this.dbClient.deviceInverter.findFirst({
  // 	// 	where: { id: deviceId, plantId: BigInt(params.plantId), deletedAt: null },
  // 	// 	select: { id: true, name: true, type: true, serialNumber: true, online: true },
  // 	// });

  // 	if (inverter) {
  // 		return { id: `device-${String(inverter.id)}`, name: inverter.name ?? `${inverter.type} ${inverter.serialNumber}`, type: inverter.type, sn: inverter.serialNumber };
  // 	}

  // 	const datalogger = await this.dbClient.deviceDatalogger.findFirst({
  // 		where: { id: deviceId, plantId: BigInt(params.plantId), deletedAt: null },
  // 		select: { id: true, name: true, type: true, serialNumber: true, online: true },
  // 	});

  // 	if (!datalogger) {
  // 		throw new ApiError(404, 'Device not found');
  // 	}

  // 	return { id: `device-${String(datalogger.id)}`, name: datalogger.name ?? `${datalogger.type} ${datalogger.serialNumber}`, type: datalogger.type, sn: datalogger.serialNumber, status: datalogger.online ? 'online' : 'offline' };
  // }

  async getDeviceView(params: DeviceViewParams) {
    await this.getScopedPlantOrThrow(params.scope, params.plantId);
    const deviceId = this.parseDeviceId(params.deviceId);

    console.log({
      deviceId: params.deviceId,
      plantId: params.plantId,
    });

    const inverter = await this.dbClient.deviceInverter.findFirst({
      where: {
        id: deviceId,
        plantId: BigInt(params.plantId),
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        serialNumber: true,
      },
    });

    console.log("inverter>>", inverter);

    if (inverter) {
      console.log("before latestLog");

      const latestLog = await this.dbClient.deviceLogsLatest.findFirst({
        where: {
          sno: inverter.serialNumber,
        },
        orderBy: {
          latestTimestamp: "desc",
        },
      });

      console.log("latestLog", latestLog);

      console.log("before connectionStatus");

      const connectionStatus =
        await this.dbClient.deviceConnectionStatus.findFirst({
          where: {
            serialNumber: inverter.serialNumber,
          },
          select: {
            status: true,
            // lastseentime: true,
          },
        });

      console.log("connectionStatus", connectionStatus);
      return {
        id: `device-${String(inverter.id)}`,
        name: inverter.name ?? `${inverter.type} ${inverter.serialNumber}`,
        type: inverter.type,
        sn: inverter.serialNumber,

        currentPower: latestLog?.currentPower ?? null,
        eToday: latestLog?.dailyProduction ?? null,
        eTotal: latestLog?.totalEnergy ?? null,
        hTotal: latestLog?.totalHours ?? null,
        latestUpdate: latestLog?.latestTimestamp ?? null,

        status: connectionStatus?.status ?? "offline",
        // lastSeenTime: connectionStatus?.lastSeenTime ?? null,
      };
    }

    const datalogger = await this.dbClient.deviceDatalogger.findFirst({
      where: {
        id: deviceId,
        plantId: BigInt(params.plantId),
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        serialNumber: true,
      },
    });

    if (!datalogger) {
      throw new ApiError(404, "Device not found");
    }

    const [latestLog, connectionStatus] = await Promise.all([
      this.dbClient.deviceLogsLatest.findFirst({
        where: {
          sno: datalogger.serialNumber,
        },
        orderBy: {
          latestTimestamp: "desc",
        },
        select: {
          currentPower: true,
          dailyProduction: true,
          totalEnergy: true,
          totalHours: true,
          latestTimestamp: true,
        },
      }),
      this.dbClient.deviceConnectionStatus.findUnique({
        where: {
          serialNumber: datalogger.serialNumber,
        },
        select: {
          status: true,
          lastSeenTime: true,
        },
      }),
    ]);

    return {
      id: `device-${String(datalogger.id)}`,
      name: datalogger.name ?? `${datalogger.type} ${datalogger.serialNumber}`,
      type: datalogger.type,
      sn: datalogger.serialNumber,

      currentPower: latestLog?.currentPower ?? null,
      eToday: latestLog?.dailyProduction ?? null,
      eTotal: latestLog?.totalEnergy ?? null,
      hTotal: latestLog?.totalHours ?? null,
      latestUpdate: latestLog?.latestTimestamp ?? null,

      status: connectionStatus?.status ?? "offline",
      lastSeenTime: connectionStatus?.lastSeenTime ?? null,
    };
  }

  async editDevice(params: DeviceEditParams) {
    await this.getScopedPlantOrThrow(params.scope, params.plantId);
    const deviceId = this.parseDeviceId(params.deviceId);

    const inverter = await this.dbClient.deviceInverter.findFirst({
      where: { id: deviceId, plantId: BigInt(params.plantId), deletedAt: null },
      select: { id: true },
    });
    if (inverter) {
      const updated = await this.dbClient.deviceInverter.update({
        where: { id: deviceId },
        data: { name: params.name, updatedAt: new Date() },
        select: { id: true, updatedAt: true },
      });
      return {
        id: `device-${String(updated.id)}`,
        updatedAt: updated.updatedAt.toISOString(),
      };
    }

    const datalogger = await this.dbClient.deviceDatalogger.findFirst({
      where: { id: deviceId, plantId: BigInt(params.plantId), deletedAt: null },
      select: { id: true },
    });
    if (!datalogger) {
      throw new ApiError(404, "Device not found");
    }

    const updated = await this.dbClient.deviceDatalogger.update({
      where: { id: deviceId },
      data: { name: params.name, updatedAt: new Date() },
      select: { id: true, updatedAt: true },
    });
    return {
      id: `device-${String(updated.id)}`,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // async deleteDevice(params: DeviceDeleteParams) {
  // 	await this.getScopedPlantOrThrow(params.scope, params.plantId);
  // 	const deviceId = this.parseDeviceId(params.deviceId);

  // 	const inverter = await this.dbClient.deviceInverter.findFirst({ where: { id: deviceId, plantId: BigInt(params.plantId), deletedAt: null }, select: { id: true } });
  // 	if (inverter) {
  // 		const deleted = await this.dbClient.deviceInverter.update({ where: { id: deviceId }, data: { deletedAt: new Date() }, select: { id: true, deletedAt: true } });
  // 		return { id: `device-${String(deleted.id)}`, status: 'deleted', deletedAt: deleted.deletedAt?.toISOString() };
  // 	}
  // 	// if (inverter) {
  // 	// 	const deleted = await this.dbClient.deviceInverter.update({ where: { id: deviceId }, data: { deletedAt: new Date(), online: false, status: 'offline' }, select: { id: true, deletedAt: true } });
  // 	// 	return { id: `device-${String(deleted.id)}`, status: 'deleted', deletedAt: deleted.deletedAt?.toISOString() };
  // 	// }

  // 	const datalogger = await this.dbClient.deviceDatalogger.findFirst({ where: { id: deviceId, plantId: BigInt(params.plantId), deletedAt: null }, select: { id: true } });
  // 	if (!datalogger) {
  // 		throw new ApiError(404, 'Device not found');
  // 	}

  // 	const deleted = await this.dbClient.deviceDatalogger.update({ where: { id: deviceId }, data: { deletedAt: new Date(), online: false, status: 'offline' }, select: { id: true, deletedAt: true } });
  // 	return { id: `device-${String(deleted.id)}`, status: 'deleted', deletedAt: deleted.deletedAt?.toISOString() };
  // }

  async deleteDevice(params: DeviceDeleteParams) {
    await this.getScopedPlantOrThrow(params.scope, params.plantId);
    console.log("params", params.scope);

    const deviceId = this.parseDeviceId(params.deviceId);

    const inverter = await this.dbClient.deviceInverter.findFirst({
      where: {
        id: deviceId,
        plantId: BigInt(params.plantId),
        deletedAt: null,
      },
      select: {
        id: true,
        serialNumber: true,
      },
    });

    if (inverter) {
      const deletedSerial = `${inverter.serialNumber}_deleted`;

      const deleted = await this.dbClient.$transaction(async (tx) => {
        const updatedInverter = await tx.deviceInverter.update({
          where: {
            id: deviceId,
          },
          data: {
            deletedAt: new Date(),
            serialNumber: deletedSerial,
          },
          select: {
            id: true,
            deletedAt: true,
          },
        });

        await tx.userPlantInverterMap.updateMany({
          where: {
            serialNumber: inverter.serialNumber,
          },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
            serialNumber: deletedSerial,
          },
        });

        return updatedInverter;
      });

      return {
        id: `device-${String(deleted.id)}`,
        status: "deleted",
        deletedAt: deleted.deletedAt?.toISOString(),
      };
    }

    const datalogger = await this.dbClient.deviceDatalogger.findFirst({
      where: {
        id: deviceId,
        plantId: BigInt(params.plantId),
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!datalogger) {
      throw new ApiError(404, "Device not found");
    }

    const deleted = await this.dbClient.deviceDatalogger.update({
      where: {
        id: deviceId,
      },
      data: {
        deletedAt: new Date(),
        online: false,
        status: "offline",
      },
      select: {
        id: true,
        deletedAt: true,
      },
    });

    return {
      id: `device-${String(deleted.id)}`,
      status: "deleted",
      deletedAt: deleted.deletedAt?.toISOString(),
    };
  }

  async getDeviceDayChartLogs(params: { sno: string; date: string }) {
    const [year, month, day] = params.date.split("-").map(Number);

    // Convert IST day boundaries to UTC
    const start = new Date(Date.UTC(year, month - 1, day, -5, -30, 0));

    const end = new Date(Date.UTC(year, month - 1, day + 1, -5, -30, 0));

    return this.dbClient.deviceLogs.findMany({
      where: {
        sno: params.sno,

        timestamp: {
          gte: start,
          lt: end,
        },
      },

      select: {
        timestamp: true,
        total_input_power: true,
      },

      orderBy: {
        timestamp: "asc",
      },
    });
  }

  async getDeviceMonthChartLogs(params: { sno: string; date: string }) {
    const current = new Date(params.date);

    const start = new Date(current.getFullYear(), current.getMonth(), 1);

    const end = new Date(current.getFullYear(), current.getMonth() + 1, 1);

    return this.dbClient.deviceLogsLatest.findMany({
      where: {
        sno: params.sno,
        latestTimestamp: {
          gte: start,
          lt: end,
        },
      },

      select: {
        dayDate: true,
        latestTimestamp: true,
        dailyProduction: true,
        totalEnergy: true,
      },

      orderBy: {
        dayDate: "asc",
      },
    });
  }

  async getDeviceYearChartLogs(params: { sno: string; date: string }) {
    const current = new Date(params.date);

    const start = new Date(current.getFullYear(), 0, 1);

    const end = new Date(current.getFullYear() + 1, 0, 1);

    return this.dbClient.deviceLogsLatest.findMany({
      where: {
        sno: params.sno,
        latestTimestamp: {
          gte: start,
          lt: end,
        },
      },

      select: {
        latestTimestamp: true,
        dailyProduction: true,
        totalEnergy: true,
      },

      orderBy: {
        latestTimestamp: "asc",
      },
    });
  }

  async getDeviceChartSnapshot(
    params: DeviceChartContextParams,
  ): Promise<DeviceChartSnapshot> {
    const plantId = this.parsePlantId(params.plantId);
    const deviceId = this.parseDeviceId(params.deviceId);

    const plant = await this.dbClient.plant.findFirst({
      where: {
        id: plantId,
        deletedAt: null,
      },
      select: {
        id: true,
        userAccount: true,
      },
    });

    if (!plant) {
      throw new ApiError(404, "Plant not found.");
    }

    const inverter = await this.dbClient.deviceInverter.findFirst({
      where: {
        id: deviceId,
        plantId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        serialNumber: true,
        // powerValue: true,
        // eTodayValue: true,
        // eTotalValue: true,
        // hTotalValue: true,
        updatedAt: true,
        updateTime: true,
      },
    });

    if (inverter) {
      return {
        plantId: plant.id,
        plantAccount: plant.userAccount,
        device: {
          id: inverter.id,
          name: inverter.name ?? `${inverter.type} ${inverter.serialNumber}`,
          type: inverter.type,
          sn: inverter.serialNumber,
          // powerValue: inverter.powerValue,
          // eTodayValue: inverter.eTodayValue,
          // eTotalValue: inverter.eTotalValue,
          // hTotalValue: inverter.hTotalValue,
          updatedAt: inverter.updateTime ?? inverter.updatedAt,
        },
      };
    }

    const datalogger = await this.dbClient.deviceDatalogger.findFirst({
      where: {
        id: deviceId,
        plantId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        serialNumber: true,
        updatedAt: true,
        updateTime: true,
        inverter: {
          // 	select: {
          // 		powerValue: true,
          // 		eTodayValue: true,
          // 		eTotalValue: true,
          // 		hTotalValue: true,
          // 		updatedAt: true,
          // 		updateTime: true,
          // 	},
        },
      },
    });

    if (!datalogger) {
      throw new ApiError(404, "Device not found for this plant.");
    }

    const inverterUpdatedAt =
      datalogger.inverter?.updateTime ?? datalogger.inverter?.updatedAt;
    const dataloggerUpdatedAt = datalogger.updateTime ?? datalogger.updatedAt;

    return {
      plantId: plant.id,
      plantAccount: plant.userAccount,
      device: {
        id: datalogger.id,
        name:
          datalogger.name ?? `${datalogger.type} ${datalogger.serialNumber}`,
        type: datalogger.type,
        sn: datalogger.serialNumber,
        // powerValue: datalogger.inverter?.powerValue ?? 0,
        // eTodayValue: datalogger.inverter?.eTodayValue ?? 0,
        // eTotalValue: datalogger.inverter?.eTotalValue ?? 0,
        // hTotalValue: datalogger.inverter?.hTotalValue ?? 0,
        updatedAt:
          inverterUpdatedAt && inverterUpdatedAt > dataloggerUpdatedAt
            ? inverterUpdatedAt
            : dataloggerUpdatedAt,
      },
    };
  }

  async getDeviceCurrentAlertsSnapshot(
    params: DeviceCurrentAlertsSnapshotParams,
  ): Promise<DeviceCurrentAlertsSnapshot> {
    const plantId = this.parsePlantId(params.plantId);
    const deviceId = this.parseDeviceId(params.deviceId);

    const plant = await this.dbClient.plant.findFirst({
      where: {
        id: plantId,
        deletedAt: null,
      },
      select: {
        id: true,
        userAccount: true,
      },
    });

    if (!plant) {
      throw new ApiError(404, "Plant not found.");
    }

    const inverter = await this.dbClient.deviceInverter.findFirst({
      where: {
        id: deviceId,
        plantId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        serialNumber: true,
        // online: true,
        // status: true,
        updatedAt: true,
        updateTime: true,
      },
    });

    if (inverter) {
      return {
        plantId: plant.id,
        plantAccount: plant.userAccount,
        device: {
          id: inverter.id,
          name: inverter.name ?? `${inverter.type} ${inverter.serialNumber}`,
          type: inverter.type,
          sn: inverter.serialNumber,
          // online: inverter.online,
          // status: inverter.status,
          updatedAt: inverter.updateTime ?? inverter.updatedAt,
        },
      };
    }

    const datalogger = await this.dbClient.deviceDatalogger.findFirst({
      where: {
        id: deviceId,
        plantId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        serialNumber: true,
        online: true,
        status: true,
        updatedAt: true,
        updateTime: true,
      },
    });

    if (!datalogger) {
      throw new ApiError(404, "Device not found for this plant.");
    }

    return {
      plantId: plant.id,
      plantAccount: plant.userAccount,
      device: {
        id: datalogger.id,
        name:
          datalogger.name ?? `${datalogger.type} ${datalogger.serialNumber}`,
        type: datalogger.type,
        sn: datalogger.serialNumber,
        // online: datalogger.online,
        // status: datalogger.status,
        updatedAt: datalogger.updateTime ?? datalogger.updatedAt,
      },
    };
  }

  async getDeviceInformationRealtimeSnapshot(
    params: DeviceInformationSnapshotParams,
  ) {
    const inverter = await this.dbClient.deviceInverter.findFirst({
      where: {
        id: BigInt(params.deviceId),
        plantId: BigInt(params.plantId),
        deletedAt: null,
      },
      include: {
        plant: true,
      },
    });

    if (!inverter) {
      return null;
    }

    const latestLog = await this.dbClient.deviceLogs.findFirst({
      where: {
        sno: inverter.serialNumber,
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    const latestSummary = await this.dbClient.deviceLogsLatest.findFirst({
      where: {
        sno: inverter.serialNumber,
      },
      orderBy: {
        latestTimestamp: "desc",
      },
    });

    return {
      device: inverter,
      plantAccount: inverter.plant.userAccount,
      log: latestLog,
      latestSummary,
    };
  }
  async getDeviceInformationSnapshot(
    params: DeviceInformationSnapshotParams,
  ): Promise<DeviceInformationSnapshot> {
    const plantId = this.parsePlantId(params.plantId);
    const deviceId = this.parseDeviceId(params.deviceId);

    const plant = await this.dbClient.plant.findFirst({
      where: {
        id: plantId,
        deletedAt: null,
      },
      select: {
        id: true,
        userAccount: true,
      },
    });

    if (!plant) {
      throw new ApiError(404, "Plant not found.");
    }

    const inverter = await this.dbClient.deviceInverter.findFirst({
      where: {
        id: deviceId,
        plantId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        serialNumber: true,
        updatedAt: true,
        updateTime: true,

        dataloggers: {
          where: {
            deletedAt: null,
          },
          select: {
            serialNumber: true,
          },
          orderBy: {
            id: "asc",
          },
          take: 1,
        },
      },
    });

    if (inverter) {
      const latestLog = inverter.serialNumber
        ? await this.dbClient.deviceLogsLatest.findFirst({
            where: {
              sno: inverter.serialNumber,
            },
            orderBy: {
              latestTimestamp: "desc",
            },
            select: {
              currentPower: true,
              dailyProduction: true,
              totalEnergy: true,
              totalHours: true,
              latestTimestamp: true,
            },
          })
        : null;

      return {
        plantId: plant.id,
        plantAccount: plant.userAccount,
        device: {
          id: inverter.id,
          name: inverter.name ?? `${inverter.type} ${inverter.serialNumber}`,
          type: inverter.type,
          sn: inverter.serialNumber,

          // removed because not in schema
          // status: null,
          // online: null,

          // powerValue: latestLog?.currentPower ?? 0,
          // eTodayValue: latestLog?.dailyProduction ?? 0,
          // eTotalValue: latestLog?.totalEnergy ?? 0,
          // hTotalValue: latestLog?.totalHours ?? 0,

          updatedAt:
            latestLog?.latestTimestamp ??
            inverter.updateTime ??
            inverter.updatedAt,

          communicationModuleSn: inverter.dataloggers[0]?.serialNumber ?? "N/A",
        },
      };
    }

    const datalogger = await this.dbClient.deviceDatalogger.findFirst({
      where: {
        id: deviceId,
        plantId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        serialNumber: true,
        status: true,
        online: true,
        updatedAt: true,
        updateTime: true,
        inverter: {
          // select: {
          // 	powerValue: true,
          // 	eTodayValue: true,
          // 	eTotalValue: true,
          // 	hTotalValue: true,
          // 	updatedAt: true,
          // 	updateTime: true,
          // },
        },
      },
    });

    if (!datalogger) {
      throw new ApiError(404, "Device not found for this plant.");
    }

    const inverterUpdatedAt =
      datalogger.inverter?.updateTime ?? datalogger.inverter?.updatedAt;

    const dataloggerUpdatedAt = datalogger.updateTime ?? datalogger.updatedAt;

    return {
      plantId: plant.id,
      plantAccount: plant.userAccount,
      device: {
        id: datalogger.id,
        name:
          datalogger.name ?? `${datalogger.type} ${datalogger.serialNumber}`,
        type: datalogger.type,
        sn: datalogger.serialNumber,
        // status: datalogger.status,
        // online: datalogger.online,

        // powerValue:
        // 	datalogger.inverter?.powerValue ?? 0,

        // eTodayValue:
        // 	datalogger.inverter?.eTodayValue ?? 0,

        // eTotalValue:
        // 	datalogger.inverter?.eTotalValue ?? 0,

        // hTotalValue:
        // 	datalogger.inverter?.hTotalValue ?? 0,

        updatedAt:
          inverterUpdatedAt && inverterUpdatedAt > dataloggerUpdatedAt
            ? inverterUpdatedAt
            : dataloggerUpdatedAt,

        communicationModuleSn: datalogger.serialNumber,
      },
    };
  }

  // async getDeviceInformationSnapshot(
  // 	params: DeviceInformationSnapshotParams,
  // ): Promise<DeviceInformationSnapshot> {
  // 	const plantId = this.parsePlantId(params.plantId);
  // 	const deviceId = this.parseDeviceId(params.deviceId);

  // 	const plant = await this.dbClient.plant.findFirst({
  // 		where: {
  // 			id: plantId,
  // 			deletedAt: null,
  // 		},
  // 		select: {
  // 			id: true,
  // 			userAccount: true,
  // 		},
  // 	});

  // 	if (!plant) {
  // 		throw new ApiError(404, 'Plant not found.');
  // 	}

  // 	const inverter = await this.dbClient.deviceInverter.findFirst({
  // 		where: {
  // 			id: deviceId,
  // 			plantId,
  // 			deletedAt: null,
  // 		},
  // 		select: {
  // 			id: true,
  // 			name: true,
  // 			type: true,
  // 			serialNumber: true,
  // 			status: true,
  // 			online: true,
  // 			powerValue: true,
  // 			eTodayValue: true,
  // 			eTotalValue: true,
  // 			hTotalValue: true,
  // 			updatedAt: true,
  // 			updateTime: true,
  // 			dataloggers: {
  // 				where: { deletedAt: null },
  // 				select: {
  // 					serialNumber: true,
  // 				},
  // 				orderBy: { id: 'asc' },
  // 				take: 1,
  // 			},
  // 		},
  // 	});

  // 	if (inverter) {
  // 		return {
  // 			plantId: plant.id,
  // 			plantAccount: plant.userAccount,
  // 			device: {
  // 				id: inverter.id,
  // 				name: inverter.name ?? `${inverter.type} ${inverter.serialNumber}`,
  // 				type: inverter.type,
  // 				sn: inverter.serialNumber,
  // 				status: inverter.status,
  // 				online: inverter.online,
  // 				powerValue: inverter.powerValue,
  // 				eTodayValue: inverter.eTodayValue,
  // 				eTotalValue: inverter.eTotalValue,
  // 				hTotalValue: inverter.hTotalValue,
  // 				updatedAt: inverter.updateTime ?? inverter.updatedAt,
  // 				communicationModuleSn: inverter.dataloggers[0]?.serialNumber ?? 'N/A',
  // 			},
  // 		};
  // 	}

  // 	const datalogger = await this.dbClient.deviceDatalogger.findFirst({
  // 		where: {
  // 			id: deviceId,
  // 			plantId,
  // 			deletedAt: null,
  // 		},
  // 		select: {
  // 			id: true,
  // 			name: true,
  // 			type: true,
  // 			serialNumber: true,
  // 			status: true,
  // 			online: true,
  // 			updatedAt: true,
  // 			updateTime: true,
  // 			inverter: {
  // 				select: {
  // 					powerValue: true,
  // 					eTodayValue: true,
  // 					eTotalValue: true,
  // 					hTotalValue: true,
  // 					updatedAt: true,
  // 					updateTime: true,
  // 				},
  // 			},
  // 		},
  // 	});

  // 	if (!datalogger) {
  // 		throw new ApiError(404, 'Device not found for this plant.');
  // 	}

  // 	const inverterUpdatedAt = datalogger.inverter?.updateTime ?? datalogger.inverter?.updatedAt;
  // 	const dataloggerUpdatedAt = datalogger.updateTime ?? datalogger.updatedAt;

  // 	return {
  // 		plantId: plant.id,
  // 		plantAccount: plant.userAccount,
  // 		device: {
  // 			id: datalogger.id,
  // 			name: datalogger.name ?? `${datalogger.type} ${datalogger.serialNumber}`,
  // 			type: datalogger.type,
  // 			sn: datalogger.serialNumber,
  // 			status: datalogger.status,
  // 			online: datalogger.online,
  // 			powerValue: datalogger.inverter?.powerValue ?? 0,
  // 			eTodayValue: datalogger.inverter?.eTodayValue ?? 0,
  // 			eTotalValue: datalogger.inverter?.eTotalValue ?? 0,
  // 			hTotalValue: datalogger.inverter?.hTotalValue ?? 0,
  // 			updatedAt: inverterUpdatedAt && inverterUpdatedAt > dataloggerUpdatedAt ? inverterUpdatedAt : dataloggerUpdatedAt,
  // 			communicationModuleSn: datalogger.serialNumber,
  // 		},
  // 	};
  // }
}
