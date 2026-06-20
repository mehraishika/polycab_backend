import { ApiError } from '@/server/utils/api-error';
import { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import {
  PlantRepository,
  type PlantInformationRecord,
  type PlantChartExportParams,
  type PlantChartParams,
  type PlantCurrentAlertsParams,
  type PlantAnalysisDevicesParams,
  type PlantAnalysisParametersParams,
  type PlantAnalysisParams,
  type LiveRowsParams,
  type PlantOverviewParams,
  type PlantListParams,
  type PlantSummaryParams,
  type PlantLogsParams,
  type PlantLogsExportParams,
  type PlantDeviceOverviewParams,
  type PlantDeviceOverviewLiveParams,
  type PlantDeviceOverviewSnapshot,
  type UserLogsParams
} from '@/server/repositories/plant.repository';
import { UserRepository } from '@/server/repositories/user.repository';




export interface UserLogsServiceParams {
  user: User;
  page: number;
  pageSize: number;
  search: string;
  event: string;
  dateFrom?: string;
  dateTo?: string;
  fromService?: boolean;
  targetEndUserId?: string;
}

export interface PlantInformationParams {
  user: User;
  plantId: string;
  fromService?: boolean;
  targetEndUserId?: string;
}

export interface PlantInformationLiveParams extends PlantInformationParams {
  since?: string;
}

export interface AddPlantLoggerParams extends PlantInformationParams {
  serialNumber: string;
}

export interface PlantLogsServiceParams {
  user: User;
  plantId: string;
  page: number;
  pageSize: number;
  search?: string;
  event?: string;
  dateFrom?: string;
  dateTo?: string;
  fromService?: boolean;
  targetEndUserId?: string;
}

export interface PlantLogsExportServiceParams {
  user: User;
  plantId: string;
  search?: string;
  event?: string;
  dateFrom?: string;
  dateTo?: string;
  format: 'csv';
  fromService?: boolean;
  targetEndUserId?: string;
}

export interface PlantDeviceOverviewServiceParams {
  user: User;
  plantId: string;
  deviceId: string;
  fromService?: boolean;
  targetEndUserId?: string;
}

export interface PlantDeviceOverviewLiveServiceParams extends PlantDeviceOverviewServiceParams {
  since?: string;
}

type TelemetryStats = {
  inputPowerKw: number;
  currentEfficiency: number;
  co2Ton: number;
  treePlanting: number;
  weather: string;
  irradianceWm2: number;
  cellTemperatureC: number;
  updatedAt: Date;
};

class PlantService {
  constructor(private readonly plantRepository: PlantRepository = new PlantRepository()) { }

  private formatDateTime(value: Date): string {
    return value.toISOString().replace('T', ' ').slice(0, 19);
  }

  private resolveDeviceStatus(online: boolean, status: string): 'online' | 'offline' | 'abnormal' {
    if (!online) {
      return 'offline';
    }

    if (status.includes('fault') || status.includes('abnormal')) {
      return 'abnormal';
    }

    return 'online';
  }

  // private toOverviewResponse(snapshot: PlantDeviceOverviewSnapshot) {
  //   const resolvedStatus = this.resolveDeviceStatus(snapshot.online, snapshot.status);

  //   return {
  //     device: {
  //       id: `device-${String(snapshot.id)}`,
  //       name: snapshot.name,
  //       type: snapshot.type,
  //       sn: snapshot.sn,
  //       status: resolvedStatus,
  //       icon: snapshot.online,
  //     },
  //     metrics: {
  //       currentPower: {
  //         value: Number(snapshot.currentPowerKw.toFixed(2)),
  //         unit: 'kW',
  //         dataType: 'live',
  //       },
  //       todayEnergy: {
  //         value: Number(snapshot.todayEnergyKwh.toFixed(2)),
  //         unit: 'kWh',
  //         dataType: 'daily_aggregation',
  //       },
  //       totalEnergy: {
  //         value: Number((snapshot.totalEnergyKwh / 1000).toFixed(2)),
  //         unit: 'MWh',
  //         dataType: 'total_aggregation',
  //       },
  //       hours: {
  //         value: Number(snapshot.totalHours.toFixed(2)),
  //         unit: 'Hrs',
  //         dataType: 'total_aggregation',
  //       },
  //     },
  //     lastUpdate: {
  //       value: this.formatDateTime(snapshot.lastUpdateAt),
  //       dataType: 'live',
  //     },
  //   };
  // }

  // private toOverviewLiveResponse(snapshot: PlantDeviceOverviewSnapshot) {
  //   const resolvedStatus = this.resolveDeviceStatus(snapshot.online, snapshot.status);

  //   return {
  //     device: {
  //       id: `device-${String(snapshot.id)}`,
  //       status: resolvedStatus,
  //       icon: snapshot.online,
  //     },
  //     metrics: {
  //       currentPower: {
  //         value: Number(snapshot.currentPowerKw.toFixed(2)),
  //         unit: 'kW',
  //       },
  //       todayEnergy: {
  //         value: Number(snapshot.todayEnergyKwh.toFixed(2)),
  //         unit: 'kWh',
  //       },
  //       hours: {
  //         value: Number(snapshot.totalHours.toFixed(2)),
  //         unit: 'Hrs',
  //       },
  //     },
  //     lastUpdate: {
  //       value: this.formatDateTime(snapshot.lastUpdateAt),
  //     },
  //   };
  // }

  private async resolveScope(
    user: User,
    fromService?: boolean,
    targetEndUserId?: string,
  ): Promise<string[]> {
    const baseScope = await resolveUserScope(user);
    const userRepository = new UserRepository();

    const hasServiceRole =
      user.role === 'service_admin' ||
      user.role === 'service_super_admin';

    if (fromService && hasServiceRole && targetEndUserId) {
      const accountScope =
        await userRepository.getAccountScopeByUserId(
          targetEndUserId,
        );

      console.log('accountScope =>', accountScope);

      if (!accountScope) {
        throw new ApiError(
          404,
          'Selected end user not found',
        );
      }

      return accountScope;
    }

    return baseScope;
  }

  private assertPlantAccess(scope: string[], plant: PlantInformationRecord) {
    if (!scope || scope.length === 0) {
      throw new ApiError(403, 'Unauthorized access to plants');
    }

    if (!scope.includes(plant.userAccount)) {
      throw new ApiError(403, 'You do not have access to this plant.');
    }
  }

  private async calculateTelemetryStats(
    plant: {
      latitude: string | null;
      longitude: string | null;
      kwp: number | null;
    },

    telemetryRows: Array<{
      sno: string;
      currentPower: number | null;
      totalEnergy: number | null;
      totalHours: number | null;
      latestTimestamp: Date;
      updatedAt: Date | null;
    }>,
  ) {
    const lat =
      Number(plant.latitude ?? 0);

    const lon =
      Number(plant.longitude ?? 0);

    /* ==========================
       Latest Telemetry Values
    ========================== */

    const inputPowerKw =
      telemetryRows.reduce(
        (sum, row) =>
          sum +
          Number(
            row.currentPower ?? 0,
          ),
        0,
      ) / 1000;

    const totalEnergyKwh =
      telemetryRows.reduce(
        (sum, row) =>
          sum +
          Number(
            row.totalEnergy ?? 0,
          ),
        0,
      );

    const totalHours =
      telemetryRows.reduce(
        (sum, row) =>
          sum +
          Number(
            row.totalHours ?? 0,
          ),
        0,
      );

    /* ==========================
       External APIs
    ========================== */

    const weatherUrl =
      `${process.env.OPEN_WEATHER_URL}` +
      `?lat=${lat}` +
      `&lon=${lon}` +
      `&appid=${process.env.OPENWEATHER_API_KEY}` +
      `&units=metric`;

    const irradianceUrl =
      `${process.env.SOLAR_IRRADIANCE_URL}` +
      `?latitude=${lat}` +
      `&longitude=${lon}` +
      `&hourly=shortwave_radiation_instant` +
      `&models=satellite_radiation_seamless` +
      `&temporal_resolution=native`;

    let weatherData: any = {
      main: {},
      weather: [],
    };

    let irradianceData: any = {
      hourly: {
        time: [],
        shortwave_radiation_instant: [],
      },
    };

    try {
      const [
        weatherRes,
        irradianceRes,
      ] = await Promise.all([
        fetch(weatherUrl, {
          next: {
            revalidate: 300,
          },

          signal:
            AbortSignal.timeout(
              5000,
            ),
        }),

        fetch(irradianceUrl, {
          next: {
            revalidate: 300,
          },

          signal:
            AbortSignal.timeout(
              5000,
            ),
        }),
      ]);

      weatherData =
        weatherRes.ok
          ? await weatherRes.json()
          : weatherData;

      irradianceData =
        irradianceRes.ok
          ? await irradianceRes.json()
          : irradianceData;

    } catch (err) {
      console.error(
        "Telemetry API error",
        err,
      );
    }

    /* ==========================
       Irradiance
    ========================== */

    const times =
      irradianceData?.hourly?.time ??
      [];

    const values =
      irradianceData?.hourly
        ?.shortwave_radiation_instant ??
      [];

    const now =
      new Date();

    now.setSeconds(0, 0);

    now.setMinutes(
      Math.floor(
        now.getMinutes() / 15,
      ) * 15,
    );

    const currentTime =
      now.toISOString().slice(
        0,
        16,
      );

    const index =
      times.indexOf(
        currentTime,
      );

    const irradianceWm2 =
      index !== -1
        ? Number(
          values[index] ?? 0,
        )
        : 0;

    /* ==========================
       Temperature
    ========================== */

    const ambientTemp =
      Number(
        weatherData?.main?.temp ??
        0,
      );

    const noct =
      Number(
        process.env.NOCT ??
        45,
      );

    const cellTemperatureC =
      ambientTemp +
      (irradianceWm2 / 800) *
      (noct - 20);

    /* ==========================
       Efficiency
    ========================== */

    let currentEfficiency =
      0;

    if (
      totalHours > 0 &&
      plant.kwp &&
      plant.kwp > 0
    ) {
      const avgPower =
        totalEnergyKwh /
        totalHours;

      currentEfficiency =
        (avgPower /
          plant.kwp) *
        100;

      currentEfficiency =
        Math.min(
          Math.max(
            currentEfficiency,
            0,
          ),
          100,
        );
    }

    /* ==========================
       CO2
    ========================== */

    const gef =
      Number(
        process.env
          .GRID_EMISSION_FACTOR ??
        0.82,
      );

    const co2Ton =
      (totalEnergyKwh *
        gef) /
      1000;

    const treePlanting =
      (co2Ton * 1000) /
      Number(
        process.env
          .CO2_ABSORPTION_FACTOR ??
        22,
      );

    /* ==========================
       Latest Timestamp
    ========================== */

    const latestUpdatedAt =
      telemetryRows
        .sort(
          (a, b) =>
            b.latestTimestamp.getTime() -
            a.latestTimestamp.getTime(),
        )[0]
        ?.latestTimestamp ??
      new Date();

    return {
      inputPowerKw,

      co2Ton,

      treePlanting,

      currentEfficiency,

      weather:
        weatherData?.weather?.[0]
          ?.description ??
        "N/A",

      irradianceWm2,

      cellTemperatureC,

      updatedAt:
        this.formatDateTime(
          latestUpdatedAt,
        ),
    };
  }
  getPlantList(params: PlantListParams) {
    return this.plantRepository.getPlantList(params);
  }

  getPlantSummary(params: PlantSummaryParams) {
    return this.plantRepository.getPlantSummary(params);
  }

  getLiveRows(params: LiveRowsParams) {
    return this.plantRepository.getLiveRows(params);
  }

  getPlantOverview(params: PlantOverviewParams) {
    return this.plantRepository.getPlantOverview(params);
  }

  getPlantOverviewLive(params: PlantOverviewParams) {
    return this.plantRepository.getPlantOverviewLive(params);
  }

  getPlantAnalysisDevices(params: PlantAnalysisDevicesParams) {
    return this.plantRepository.getPlantAnalysisDevices(params);
  }

  getPlantAnalysisParameters(params: PlantAnalysisParametersParams) {
    return this.plantRepository.getPlantAnalysisParameters(params);
  }

  getPlantAnalysis(params: PlantAnalysisParams) {
    return this.plantRepository.getPlantAnalysis(params);
  }

  getPlantChart(params: PlantChartParams) {
    return this.plantRepository.getPlantChart(params);
  }

  exportPlantChart(params: PlantChartExportParams) {
    return this.plantRepository.exportPlantChart(params);
  }
  exportPlantList(params: PlantListParams) {
    return this.plantRepository.exportPlantList(
      params.user,
      params.scope,
      params.fromService,
      params.targetEndUserId,
    );
  }

  getPlantCurrentAlerts(params: PlantCurrentAlertsParams) {
    return this.plantRepository.getPlantCurrentAlerts(params);
  }



  async getPlantInformation(params: PlantInformationParams) {
    const scope = await this.resolveScope(params.user, params.fromService, params.targetEndUserId);
    if (scope.length === 0) {
      throw new ApiError(403, 'Unauthorized access to plants');
    }

    const plant = await this.plantRepository.findPlantInformationById(params.plantId);
    if (!plant) {
      throw new ApiError(404, 'Plant not found.');
    }

    this.assertPlantAccess(scope, plant);

    const [
      dataloggers,
      inverterSerials,
    ] = await Promise.all([
      this.plantRepository
        .listPlantDataloggers(
          params.plantId,
        ),

      this.plantRepository
        .listPlantInverterSerials(
          BigInt(params.plantId),
        )
    ]);

    const serialNumbers =
      inverterSerials.map(
        x => x.serialNumber,
      );

    const telemetryRows =
      await this.plantRepository
        .getLatestTelemetryBySerials(
          serialNumbers,
        );

    const telemetry =
      await this.calculateTelemetryStats(
        plant,
        telemetryRows,
      );

    return {
      installationDate: plant.installed ? plant.installed.toISOString().slice(0, 10) : null,
      capacity: `${Number((plant.kwp ?? 0).toFixed(2))} kW`,
      address: plant.address ?? null,
      dataloggerSn: dataloggers.map((item) => item.serialNumber),
      stats: [
        {
          label: 'Input Power',
          value: `${telemetry.inputPowerKw.toFixed(2)} kW`,
          icon: '/images/information-tab/info-img-1.png',
        },
        {
          label: 'CO2',
          value: `${telemetry.co2Ton.toFixed(2)}t`,
          icon: '/images/information-tab/info-img-2.png',
        },
        {
          label: 'Tree Planting',
          value: `${telemetry.treePlanting.toFixed(2)}`,
          icon: '/images/information-tab/info-img-3.png',
        },
        {
          label: 'Efficiency',
          value: `${telemetry.currentEfficiency.toFixed(2)}`,
          icon: '/images/information-tab/info-img-4.png',
        },
        {
          label: 'Weather',
          value: telemetry.weather,
          icon: '/images/information-tab/info-img-5.png',
        },
        {
          label: 'Irradiance',
          value: `${telemetry.irradianceWm2} W/m2`,
          icon: '/images/information-tab/info-img-6.png',
        },
        {
          label: 'Cell Temperature',
          value: `${telemetry.cellTemperatureC} C`,
          icon: '/images/information-tab/info-img-7.png',
        },
      ],
      updatedAt:
        telemetry.updatedAt,
    };
  }

  async addPlantLogger(params: AddPlantLoggerParams) {
    const scope = await this.resolveScope(params.user, params.fromService, params.targetEndUserId);
    if (scope.length === 0) {
      throw new ApiError(403, 'Unauthorized access to plants');
    }

    const plant = await this.plantRepository.findPlantInformationById(params.plantId);
    if (!plant) {
      throw new ApiError(404, 'Plant not found.');
    }

    this.assertPlantAccess(scope, plant);

    const normalizedSerialNumber = params.serialNumber.trim();
    const existingLogger = await this.plantRepository.findDataloggerBySerialNumber(normalizedSerialNumber);

    if (existingLogger && !existingLogger.deletedAt) {
      throw new ApiError(409, 'Logger serial number is already linked.');
    }

    const linked = existingLogger
      ? await this.plantRepository.restorePlantLogger(existingLogger.id, params.plantId, normalizedSerialNumber)
      : await this.plantRepository.createPlantLogger(params.plantId, normalizedSerialNumber);
    const linkedAt = 'updatedAt' in linked ? linked.updatedAt : linked.createdAt;

    return {
      deviceId: `logger-${String(linked.id)}`,
      serialNumber: linked.serialNumber,
      linkedAt: linkedAt.toISOString(),
    };
  }

  // async getPlantInformationLive(params: PlantInformationLiveParams) {
  //   const scope = await this.resolveScope(params.user, params.fromService, params.targetEndUserId);
  //   if (scope.length === 0) {
  //     throw new ApiError(403, 'Unauthorized access to plants');
  //   }

  //   const plant = await this.plantRepository.findPlantInformationById(params.plantId);
  //   if (!plant) {
  //     throw new ApiError(404, 'Plant not found.');
  //   }

  //   this.assertPlantAccess(scope, plant);

  //   const inverters = await this.plantRepository.listPlantInverterTelemetry(params.plantId);
  //   const telemetry = this.calculateTelemetryStats(plant, inverters);

  //   if (params.since) {
  //     const sinceDate = new Date(params.since);
  //     if (!Number.isNaN(sinceDate.getTime()) && telemetry.updatedAt <= sinceDate) {
  //       return {
  //         stats: [],
  //         updatedAt: telemetry.updatedAt.toISOString(),
  //       };
  //     }
  //   }

  //   return {
  //     stats: [
  //       {
  //         label: 'Input Power',
  //         value: `${telemetry.inputPowerKw.toFixed(2)} kW`,
  //       },
  //       {
  //         label: 'Efficiency',
  //         value: `${telemetry.currentEfficiency.toFixed(2)}`,
  //       },
  //       {
  //         label: 'Weather',
  //         value: telemetry.weather,
  //       },
  //       {
  //         label: 'Irradiance',
  //         value: `${telemetry.irradianceWm2} W/m2`,
  //       },
  //       {
  //         label: 'Cell Temperature',
  //         value: `${telemetry.cellTemperatureC} C`,
  //       },
  //     ],
  //     updatedAt: telemetry.updatedAt.toISOString(),
  //   };
  // }

  // async getPlantDeviceOverview(params: PlantDeviceOverviewServiceParams) {
  //   const scope = await this.resolveScope(params.user, params.fromService, params.targetEndUserId);
  //   if (scope.length === 0) {
  //     throw new ApiError(403, 'Unauthorized access to plants');
  //   }

  //   const plant = await this.plantRepository.findPlantInformationById(params.plantId);
  //   if (!plant) {
  //     throw new ApiError(404, 'Plant not found.');
  //   }

  //   this.assertPlantAccess(scope, plant);

  //   const repoParams: PlantDeviceOverviewParams = {
  //     plantId: params.plantId,
  //     deviceId: params.deviceId,
  //   };

  //   const snapshot = await this.plantRepository.getPlantDeviceOverviewSnapshot(repoParams);
  //   return this.toOverviewResponse(snapshot);
  // }

  // async getPlantDeviceOverviewLive(params: PlantDeviceOverviewLiveServiceParams) {
  //   const scope = await this.resolveScope(params.user, params.fromService, params.targetEndUserId);
  //   if (scope.length === 0) {
  //     throw new ApiError(403, 'Unauthorized access to plants');
  //   }

  //   const plant = await this.plantRepository.findPlantInformationById(params.plantId);
  //   if (!plant) {
  //     throw new ApiError(404, 'Plant not found.');
  //   }

  //   this.assertPlantAccess(scope, plant);

  //   const repoParams: PlantDeviceOverviewLiveParams = {
  //     plantId: params.plantId,
  //     deviceId: params.deviceId,
  //     since: params.since,
  //   };

  //   const snapshot = await this.plantRepository.getPlantDeviceOverviewSnapshot(repoParams);
  //   return this.toOverviewLiveResponse(snapshot);
  // }

  getPlantDetails(user: User, scope: string[], plantId: string) {
    void user;
    return this.plantRepository.getPlantDetails(scope, plantId);
  }

  createPlant(user: User, scope: string[], plantData: any) {
    return this.plantRepository.createPlant(user, scope, plantData);
  }

  editPlant(user: User, scope: string[], plantId: string, plantData: any) {
    void user;
    return this.plantRepository.editPlant(scope, plantId, plantData);
  }

  deletePlant(user: User, scope: string[], plantId: string) {
    void user;
    return this.plantRepository.deletePlant(scope, plantId);
  }

  async getPlantLogs(params: PlantLogsServiceParams) {
    const scope = await this.resolveScope(params.user, params.fromService, params.targetEndUserId);
    console.log({
      role: params.user.role,
      fromService: params.fromService,
      targetEndUserId: params.targetEndUserId,
      scope,
    });
    if (scope.length === 0) {
      throw new ApiError(403, 'Unauthorized access to plants');
    }

    const plant = await this.plantRepository.findPlantInformationById(params.plantId);
    if (!plant) {
      throw new ApiError(404, 'Plant not found.');
    }

    this.assertPlantAccess(scope, plant);

    const logsParams: PlantLogsParams = {
      scope,
      plantId: params.plantId,
      page: params.page,
      pageSize: params.pageSize,
      search: params.search,
      event: params.event,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    };

    return this.plantRepository.getPlantLogs(logsParams);
  }

  async exportPlantLogs(params: PlantLogsExportServiceParams) {
    const scope = await this.resolveScope(params.user, params.fromService, params.targetEndUserId);
    if (scope.length === 0) {
      throw new ApiError(403, 'Unauthorized access to plants');
    }

    const plant = await this.plantRepository.findPlantInformationById(params.plantId);
    if (!plant) {
      throw new ApiError(404, 'Plant not found.');
    }

    this.assertPlantAccess(scope, plant);

    const exportParams: PlantLogsExportParams = {
      scope,
      plantId: params.plantId,
      search: params.search,
      event: params.event,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      format: params.format,
    };

    return this.plantRepository.exportPlantLogs(exportParams);
  }

  async getUserLogs(params: UserLogsServiceParams) {
    console.log('getUserLogs params:', {
      userId: params.user.userId,
      role: params.user.role,
      fromService: params.fromService,
      targetEndUserId: params.targetEndUserId,
    });
    const scope = await this.resolveScope(
      params.user,
      params.fromService,
      params.targetEndUserId
    );

    console.log('scope =>', scope);

    if (scope.length === 0) {
      throw new ApiError(
        403,
        'Unauthorized access to plants'
      );
    }

    return this.plantRepository.getUserLogs({
      scope,
      page: params.page,
      pageSize: params.pageSize,
      search: params.search,
      event: params.event,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });
  }
}

const plantService = new PlantService();

/**
 * Get Plant List with filtering, pagination, and status counts
 * Step 1: Validates JWT token scope
 * Step 2: Applies search filtering by plant name or serial number
 * Step 3: Calculates statusCounts for display
 * Step 4: Applies status tab filter
 * Step 5: Applies pagination and sorting
 */
export async function getPlantList(params: PlantListParams) {
  return plantService.getPlantList(params);
}

/**
 * Get Plant Summary - Live aggregated metrics and status counts
 * Step 1: Backend validates JWT token and resolves allowed scope
 * Step 2: Backend calculates live summary and statusCounts
 * Step 3: Returns listRefreshRequired flag if statusCounts changed
 */
export async function getPlantSummary(params: PlantSummaryParams) {
  return plantService.getPlantSummary(params);
}

/**
 * Get Live Rows - Latest telemetry for visible plants on current page
 * Step 1: Frontend sends current page visible plantIds
 * Step 2: Backend validates JWT and scope
 * Step 3: Backend returns latest telemetry for visible plants
 * Step 4: Reports rowStillMatchesActiveStatus if status changed
 */
export async function getLiveRows(params: LiveRowsParams) {
  return plantService.getLiveRows(params);
}

/**
 * Get Plant Overview - detail page summary + live values
 */
export async function getPlantOverview(params: PlantOverviewParams) {
  return plantService.getPlantOverview(params);
}

/**
 * Get Plant Overview Live - fast refresh for current power/today energy
 */
export async function getPlantOverviewLive(params: PlantOverviewParams) {
  return plantService.getPlantOverviewLive(params);
}

/**
 * Get Plant Analysis Device List
 */
export async function getPlantAnalysisDevices(params: PlantAnalysisDevicesParams) {
  return plantService.getPlantAnalysisDevices(params);
}

/**
 * Get Plant Analysis Parameter List for active device
 */
export async function getPlantAnalysisParameters(params: PlantAnalysisParametersParams) {
  return plantService.getPlantAnalysisParameters(params);
}

/**
 * Get Plant Analysis chart points for active device and selected parameters
 */
export async function getPlantAnalysis(params: PlantAnalysisParams) {
  return plantService.getPlantAnalysis(params);
}

/**
 * Get Plant Chart Data
 */
export async function getPlantChart(params: PlantChartParams) {
  return plantService.getPlantChart(params);
}

/**
 * Export Plant Chart as CSV
 */
export async function exportPlantChart(params: PlantChartExportParams) {
  return plantService.exportPlantChart(params);
}
export async function exportPlantList(
  user: User,
  scope: string[],
  fromService?: boolean,
  targetEndUserId?: string,
) {
  return plantService.exportPlantList({
    user,
    scope,
    page: 1,
    pageSize: 100000,
    fromService,
    targetEndUserId,
  });
}

/**
 * Get current unresolved alerts for a plant
 */
export async function getPlantCurrentAlerts(params: PlantCurrentAlertsParams) {
  return plantService.getPlantCurrentAlerts(params);
}

export async function getPlantInformation(params: PlantInformationParams) {
  return plantService.getPlantInformation(params);
}

export async function addPlantLogger(params: AddPlantLoggerParams) {
  return plantService.addPlantLogger(params);
}

export async function getPlantInformationLive(params: PlantInformationLiveParams) {
  // return plantService.getPlantInformationLive(params);
}

export async function getPlantDeviceOverview(params: PlantDeviceOverviewServiceParams) {
  // return plantService.getPlantDeviceOverview(params);
}

export async function getPlantDeviceOverviewLive(params: PlantDeviceOverviewLiveServiceParams) {
  // return plantService.getPlantDeviceOverviewLive(params);
}

/**
 * Get Plant Details - View/Edit prefill
 * Step 1: Backend validates JWT token
 * Step 2: Backend loads plant by plantId
 * Step 3: Backend checks plant.ownerUserId against allowed scope
 */
export async function getPlantDetails(user: User, scope: string[], plantId: string) {
  return plantService.getPlantDetails(user, scope, plantId);
}

/**
 * Create Plant
 * Step 1: Backend validates JWT token and create permission
 * Step 2: Backend resolves ownerUserId
 * Step 3: Backend creates plant
 */
export async function createPlant(user: User, scope: string[], plantData: any) {
  return plantService.createPlant(user, scope, plantData);
}

/**
 * Edit Plant
 * Step 1: Backend validates JWT token
 * Step 2: Backend validates edit permission
 * Step 3: Backend updates plant
 */
export async function editPlant(user: User, scope: string[], plantId: string, plantData: any) {
  return plantService.editPlant(user, scope, plantId, plantData);
}

/**
 * Delete Plant (Soft Delete)
 * Step 1: Backend validates JWT token
 * Step 2: Backend validates delete permission
 * Step 3: Backend soft-deletes plant
 */
export async function deletePlant(user: User, scope: string[], plantId: string) {
  return plantService.deletePlant(user, scope, plantId);
}

/**
 * Get Plant Logs
 * Step 1: Backend validates JWT token and scope
 * Step 2: Backend fetches logs for plant devices
 * Step 3: Backend filters by date range, event, and search
 * Step 4: Backend applies pagination
 */
export async function getPlantLogs(params: PlantLogsServiceParams) {
  return plantService.getPlantLogs(params);
}
export async function getUserLogs(params: UserLogsServiceParams) {
  return plantService.getUserLogs(params);
}

/**
 * Export Plant Logs
 * Step 1: Backend validates JWT token and scope
 * Step 2: Backend fetches logs for plant devices
 * Step 3: Backend filters by date range, event, and search
 * Step 4: Backend exports as CSV
 */
export async function exportPlantLogs(params: PlantLogsExportServiceParams) {
  return plantService.exportPlantLogs(params);
}

