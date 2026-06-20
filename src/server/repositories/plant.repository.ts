import { prisma } from '@/server/db/prisma';
import { ApiError } from '@/server/utils/api-error';
import type { User } from '@/server/utils/auth-helper';

export interface UserLogsParams {
	scope: string[];
	page: number;
	pageSize: number;
	search: string;
	event: string;
	dateFrom?: string;
	dateTo?: string;
}

export interface PlantListParams {
	user: User;
	scope: string[];
	selectedEndUserId?: string;
	search?: string;
	page: number;
	pageSize: number;
	sortBy?: string;
	sortOrder?: string;
	status?: string;
	targetEndUserId?: string;
	fromService?: boolean;
}

export interface PlantSummaryParams {
	user: User;
	scope: string[];
	search?: string;
}

export interface LiveRowsParams {
	user: User;
	scope: string[];
	plantIds: (string | number)[];
	status?: string;
	page: number;
	pageSize: number;
}

export interface PlantOverviewParams {
	scope: string[];
	plantId: string;
	since?: string;
}

export interface PlantAnalysisDevicesParams {
	scope: string[];
	plantId: string;
}

export interface PlantAnalysisParametersParams {
	scope: string[];
	plantId: string;
	deviceId: string;
}

export interface PlantAnalysisParams {
	scope: string[];
	plantId: string;
	deviceId: string;
	date: string;
	parameters: string[];
	interval: '5m' | '15m' | '30m' | '60m';
}

export interface PlantChartParams {
	scope: string[];
	plantId: string;
	range: 'day' | 'month' | 'year';
	mode: 'total' | 'single';
	date: string;
}

export interface PlantChartExportParams extends PlantChartParams {
	format: 'csv';
	fromService?: boolean;
	targetEndUserId?: string;
}

export interface PlantCurrentAlertsParams {
	scope: string[];
	plantId: string;
	status: 'active';
	page: number;
	pageSize: number;
	since?: string;
}

export interface PlantInformationRecord {
	id: bigint;
	userAccount: string;
	installed: Date | null;
	address: string | null;
	kwp: number | null;
	// powerValue: number;
	// powerUnit: string;
	// eTotalValue: number;
	// eTotalUnit: string;
	lastUpdatedAt: Date | null;
	// status: string;
}

export interface PlantTelemetryAggregateRecord {
	inputPowerKw: number;
	currentEfficiency: number;
	co2Ton: number;
	treePlanting: number;
	weather: string;
	irradianceWm2: number;
	cellTemperatureC: number;
	updatedAt: Date;
}

export interface PlantLogsParams {
	scope: string[];
	plantId: string;
	page: number;
	pageSize: number;
	search?: string;
	event?: string;
	dateFrom?: string;
	dateTo?: string;
}

export interface PlantLogsExportParams {
	scope: string[];
	plantId: string;
	search?: string;
	event?: string;
	dateFrom?: string;
	dateTo?: string;
	format: 'csv';
}

export interface PlantDeviceOverviewParams {
	plantId: string;
	deviceId: string;
}

export interface PlantDeviceOverviewLiveParams extends PlantDeviceOverviewParams {
	since?: string;
}

export interface PlantLogRecord {
	id: string;
	name: string;
	type: string;
	sn: string;
	time: string;
	// status: string;
	// event: string;
}

export interface PlantDeviceOverviewSnapshot {
	id: bigint;
	name: string;
	type: string;
	sn: string;
	// online: boolean;
	// status: string;
	// currentPowerKw: number;
	// todayEnergyKwh: number;
	// totalEnergyKwh: number;
	// totalHours: number;
	lastUpdateAt: Date;
}

export class PlantRepository {
	private formatDateTime(value: Date | null | undefined): string {
		const date = value ?? new Date();
		const iso = date.toISOString();
		return iso.replace('T', ' ').slice(0, 19);
	}

	private toMode(status: string): string {
		if (status === 'Online') return 'Normal';
		return status;
	}

	private parseDeviceIdOrThrow(deviceId: string): bigint {
		const normalized = deviceId.startsWith('device-') ? deviceId.slice('device-'.length) : deviceId;

		if (!/^\d+$/.test(normalized)) {
			throw new ApiError(400, 'Invalid device id');
		}

		return BigInt(normalized);
	}

	private getAnalysisParameterCatalog() {
		// const voltageAC = Array.from({ length: 9 }, (_, i) => ({
		// 	key: `Vac${i + 1}`,
		// 	label: `Vac${i + 1}`,
		// 	unit: 'V',
		// 	axis: 'V',
		// 	group: 'Voltage',
		// }));

		const voltage = Array.from({ length: 9 }, (_, i) => ({
			key: `Voltage${i + 1}`,
			label: `Voltage${i + 1}`,
			unit: 'V',
			axis: 'V',
			group: 'Voltage',
		}));

		const current = Array.from({ length: 9 }, (_, i) => ({
			key: `current${i + 1}`,
			label: `current${i + 1}`,
			unit: 'A',
			axis: 'A',
			group: 'Current',
		}));

		const power = Array.from({ length: 9 }, (_, i) => ({
			key: `power${i + 1}`,
			label: `power${i + 1}`,
			unit: 'kW',
			axis: 'kW',
			group: 'Power',
		}));

		return [...voltage, ...current, ...power] as const;
	}

	private getAnalysisValueByKey(key: string, powerValue: number): number {
		if (key === 'Pac1') {
			return Number(powerValue.toFixed(2));
		}

		if (key === 'Iac1') {
			const current = powerValue > 0 ? (powerValue * 1000) / 230 : 0;
			return Number(current.toFixed(2));
		}

		if (key === 'Vdc1') {
			return 650;
		}

		if (key === 'Vac1') {
			return 230;
		}

		return 0;
	}

	private parseRangeDate(range: 'day' | 'month' | 'year', date: string) {
		if (range === 'day') {
			return new Date(`${date}T00:00:00.000Z`);
		}

		if (range === 'month') {
			return new Date(`${date}-01T00:00:00.000Z`);
		}

		return new Date(`${date}-01-01T00:00:00.000Z`);
	}

	private buildChartSeries(mode: 'total' | 'single', devices: Array<{ id: bigint; name: string | null; serialNumber: string; type: string }>) {
		if (mode === 'total') {
			return [{ key: 'total', label: 'Total', color: '#2f80ed' }];
		}

		const palette = ['#54AF3A', '#FAB832', '#D32224', '#7E57C2', '#009688'];
		return devices.map((device, index) => ({
			key: `inverter${index + 1}`,
			label: device.name ?? `inverter${index + 1}`,
			color: palette[index % palette.length],
		}));
	}

	private buildChartBuckets(range: 'day' | 'month' | 'year', baseDate: Date) {
		if (range === 'day') {
			return ['07:00', '10:00', '13:00', '16:00', '19:00'];
		}

		if (range === 'month') {
			const daysInMonth = new Date(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 0).getUTCDate();
			return Array.from({ length: Math.min(daysInMonth, 6) }, (_, index) => `Day ${index + 1}`);
		}

		return ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'];
	}

	private buildChartValue(seed: number, bucketIndex: number, range: 'day' | 'month' | 'year') {
		const rangeMultiplier = range === 'day' ? 1 : range === 'month' ? 8 : 40;
		const value = seed * rangeMultiplier + bucketIndex * (range === 'day' ? 0.5 : range === 'month' ? 3 : 12);
		return Number(value.toFixed(2));
	}

	private normalizeStatusLabel(status: string | null | undefined, online: boolean): string {
		if (!status) {
			return online ? 'online' : 'offline';
		}

		return status.toLowerCase();
	}

	private buildAlertSeverity(statusLabel: string) {
		if (statusLabel.includes('offline') || statusLabel.includes('fault')) {
			return 'critical';
		}

		return 'warning';
	}

	private buildAlertEvent(statusLabel: string) {
		if (statusLabel.includes('offline')) {
			return 'Device offline';
		}

		if (statusLabel.includes('under voltage')) {
			return 'Grid under voltage';
		}

		if (statusLabel.includes('under frequency')) {
			return 'Grid under frequency';
		}

		if (statusLabel.includes('fault') || statusLabel.includes('abnormal')) {
			return 'Device fault';
		}

		return 'Device alert';
	}

	private async getChartContext(scope: string[], plantId: string) {
		const plant = await this.getScopedPlantOrThrow(scope, plantId);

		const devices = await prisma.deviceInverter.findMany({
			where: {
				plantId: plant.id,
				deletedAt: null,
			},
			select: {
				id: true,
				name: true,
				serialNumber: true,
				type: true,
				// online: true,
				// powerValue: true,
				// eTodayValue: true,
				// eTotalValue: true,
			},
			orderBy: { id: 'asc' },
		});

		return { plant, devices };
	}

	private async getCurrentAlertsContext(scope: string[], plantId: string) {
		const { plant, devices } = await this.getChartContext(scope, plantId);
		const dataloggers = await prisma.deviceDatalogger.findMany({
			where: {
				plantId: plant.id,
				deletedAt: null,
			},
			select: {
				id: true,
				name: true,
				serialNumber: true,
				type: true,
				online: true,
				status: true,
				updatedAt: true,
			},
			orderBy: { id: 'asc' },
		});

		return { plant, devices: [...devices, ...dataloggers] };
	}

	private async getScopedPlantOrThrow(scope: string[], plantId: string) {
		if (!scope || scope.length === 0) {
			throw new ApiError(403, 'Unauthorized access to plants');
		}

		let plantIdNum: bigint;
		try {
			plantIdNum = BigInt(plantId);
		} catch {
			throw new ApiError(400, 'Invalid plant id');
		}

		const plant = await prisma.plant.findFirst({
			where: {
				id: plantIdNum,
				deletedAt: null,
			},
			select: {
				id: true,
				userAccount: true,
				name: true,
				type: true,
				// status: true,
				installed: true,
				lastUpdatedAt: true,
				price: true,
				kwp: true,
			},
		});

		if (!plant) {
			throw new ApiError(404, 'Plant not found.');
		}

		if (!scope.includes(plant.userAccount)) {
			throw new ApiError(403, 'You do not have access to this plant.');
		}

		return plant;
	}

	// async getPlantOverview(params: PlantOverviewParams) {
	// 	const plant = await this.getScopedPlantOrThrow(params.scope, params.plantId);

	// 	const inverters = await prisma.deviceInverter.findMany({
	// 		where: {
	// 			plantId: plant.id,
	// 			deletedAt: null,
	// 		},
	// 		// select: {
	// 		// 	powerValue: true,
	// 		// 	eTodayValue: true,
	// 		// 	hTotalValue: true,
	// 		// },
	// 	});

	// 	const inverterPower = inverters.reduce((sum, inverter) => sum + inverter.powerValue, 0);
	// 	const inverterToday = inverters.reduce((sum, inverter) => sum + inverter.eTodayValue, 0);
	// 	const totalHours = inverters.reduce((sum, inverter) => sum + inverter.hTotalValue, 0);

	// 	const currentPower = inverters.length > 0 ? inverterPower : plant.powerValue;
	// 	const todayEnergy = inverters.length > 0 ? inverterToday : plant.eTodayValue;
	// 	const totalEnergy = plant.eTotalValue;
	// 	const totalEnergyInMWh = totalEnergy >= 1000 ? totalEnergy / 1000 : totalEnergy;
	// 	const totalEnergyUnit = totalEnergy >= 1000 ? 'MWh' : plant.eTotalUnit;
	// 	const income = (plant.price ?? 0) * totalEnergy;
	// 	const capacity = Math.round((plant.kwp ?? 0) * 1000);

	// 	return {
	// 		plant: {
	// 			id: String(plant.id),
	// 			name: plant.name,
	// 			mode: this.toMode(plant.status),
	// 			status: plant.status.toLowerCase(),
	// 			installDate: plant.installed ? plant.installed.toISOString().slice(0, 10) : null,
	// 		},
	// 		metrics: {
	// 			currentPower: {
	// 				value: Number(currentPower.toFixed(2)),
	// 				unit: plant.powerUnit || 'kW',
	// 				dataType: 'live',
	// 			},
	// 			todayEnergy: {
	// 				value: Number(todayEnergy.toFixed(2)),
	// 				unit: plant.eTodayUnit || 'kWh',
	// 				dataType: 'live',
	// 			},
	// 			totalEnergy: {
	// 				value: Number(totalEnergyInMWh.toFixed(2)),
	// 				unit: totalEnergyUnit || 'kWh',
	// 				dataType: 'summary',
	// 			},
	// 			income: {
	// 				value: Number(income.toFixed(2)),
	// 				unit: plant.price ? 'INR' : 'NA',
	// 				dataType: 'calculated',
	// 			},
	// 			hours: {
	// 				value: Number(totalHours.toFixed(2)),
	// 				unit: 'h',
	// 				dataType: 'summary',
	// 			},
	// 			capacity: {
	// 				value: capacity,
	// 				unit: 'W',
	// 				dataType: 'configuration',
	// 			},
	// 		},
	// 		lastUpdatedAt: this.formatDateTime(plant.lastUpdatedAt),
	// 	};
	// }

	async getPlantOverview(
		params: PlantOverviewParams,
	) {
		const plant =
			await this.getScopedPlantOrThrow(
				params.scope,
				params.plantId,
			);

		// Get inverter serial numbers
		const inverters =
			await prisma.deviceInverter.findMany({
				where: {
					plantId: plant.id,
					deletedAt: null,
				},

				select: {
					serialNumber: true,
				},
			});

		const serialNumbers =
			inverters
				.map(
					(inv) => inv.serialNumber,
				)
				.filter(Boolean);

		let aggregates: {
			currentPower: number;
			dailyProduction: number;
			totalEnergy: number;
			totalHours: number;
			latestTimestamp: Date | null;
		} = {
			currentPower: 0,
			dailyProduction: 0,
			totalEnergy: 0,
			totalHours: 0,
			latestTimestamp: null,
		};

		if (serialNumbers.length) {
			// latest timestamp per inverter
			const latestPerInverter =
				await prisma.deviceLogsLatest.groupBy({
					by: ['sno'],

					where: {
						sno: {
							in: serialNumbers,
						},
					},

					_max: {
						latestTimestamp: true,
					},
				});

			const latestConditions =
				latestPerInverter
					.filter(
						(item) =>
							item._max
								.latestTimestamp,
					)
					.map((item) => ({
						sno: item.sno,
						latestTimestamp:
							item._max
								.latestTimestamp!,
					}));

			const latestLogs =
				latestConditions.length
					? await prisma.deviceLogsLatest.findMany(
						{
							where: {
								OR: latestConditions,
							},

							select: {
								currentPower:
									true,
								dailyProduction:
									true,
								totalEnergy:
									true,
								totalHours:
									true,
								latestTimestamp:
									true,
							},
						},
					)
					: [];

			aggregates =
				latestLogs.reduce<{
					currentPower: number;
					dailyProduction: number;
					totalEnergy: number;
					totalHours: number;
					latestTimestamp: Date | null;
				}>(
					(acc, row) => {
						acc.currentPower +=
							row.currentPower ??
							0;

						acc.dailyProduction +=
							row.dailyProduction ??
							0;

						acc.totalEnergy +=
							row.totalEnergy ??
							0;

						acc.totalHours +=
							row.totalHours ??
							0;

						if (
							!acc.latestTimestamp ||
							(row.latestTimestamp &&
								row.latestTimestamp >
								acc.latestTimestamp)
						) {
							acc.latestTimestamp =
								row.latestTimestamp;
						}

						return acc;
					},
					{
						currentPower: 0,
						dailyProduction: 0,
						totalEnergy: 0,
						totalHours: 0,
						latestTimestamp:
							null,
					},
				);
		}

		const income =
			plant.price ?? 0;

		const totalEnergyValue =
			aggregates.totalEnergy >=
				1000
				? aggregates.totalEnergy /
				1000
				: aggregates.totalEnergy;

		const totalEnergyUnit =
			aggregates.totalEnergy >=
				1000
				? 'MWh'
				: 'kWh';

		return {
			plant: {
				id: String(
					plant.id,
				),

				name: plant.name,

				type:
					plant.type ??
					null,

				kwp:
					plant.kwp ??
					0,

				installationDate:
					plant.installed
						? plant.installed
							.toISOString()
							.slice(
								0,
								10,
							)
						: null,

				income: {
					value: Number(
						income.toFixed(
							2,
						),
					),

					unit:
						plant.price
							? 'RS.'
							: 'NA',
				},
			},

			metrics: {
				currentPower: {
					value: Number(
						aggregates.currentPower.toFixed(
							2,
						),
					),

					unit: 'kW',

					dataType:
						'live',
				},

				eToday: {
					value: Number(
						aggregates.dailyProduction.toFixed(
							2,
						),
					),

					unit: 'kWh',

					dataType:
						'live',
				},

				eTotal: {
					value: Number(
						totalEnergyValue.toFixed(
							2,
						),
					),

					unit:
						totalEnergyUnit,

					dataType:
						'summary',
				},

				hTotal: {
					value: Number(
						aggregates.totalHours.toFixed(
							2,
						),
					),

					unit: 'h',

					dataType:
						'summary',
				},

				capacity: {
					value: Math.round(
						plant.kwp ??
						0,
					),

					unit: 'kW',

					dataType:
						'configuration',
				},
			},

			lastUpdatedAt:
				this.formatDateTime(
					aggregates.latestTimestamp ??
					plant.lastUpdatedAt,
				),
		};
	}

	// async getPlantOverviewLive(params: PlantOverviewParams) {
	// 	const plant = await this.getScopedPlantOrThrow(params.scope, params.plantId);

	// 	const inverters = await prisma.deviceInverter.findMany({
	// 		where: {
	// 			plantId: plant.id,
	// 			deletedAt: null,
	// 		},
	// 		select: {
	// 			powerValue: true,
	// 			eTodayValue: true,
	// 		},
	// 	});

	// 	const currentPower =
	// 		inverters.length > 0
	// 			? inverters.reduce((sum, inverter) => sum + inverter.powerValue, 0)
	// 			: plant.powerValue;
	// 	const todayEnergy =
	// 		inverters.length > 0
	// 			? inverters.reduce((sum, inverter) => sum + inverter.eTodayValue, 0)
	// 			: plant.eTodayValue;

	// 	return {
	// 		plant: {
	// 			id: String(plant.id),
	// 			mode: this.toMode(plant.status),
	// 			status: plant.status.toLowerCase(),
	// 		},
	// 		metrics: {
	// 			currentPower: {
	// 				value: Number(currentPower.toFixed(2)),
	// 				unit: plant.powerUnit || 'kW',
	// 			},
	// 			todayEnergy: {
	// 				value: Number(todayEnergy.toFixed(2)),
	// 				unit: plant.eTodayUnit || 'kWh',
	// 			},
	// 		},
	// 		lastUpdatedAt: this.formatDateTime(plant.lastUpdatedAt),
	// 	};
	// }

	async getPlantOverviewLive(
		params: PlantOverviewParams,
	) {
		const plant =
			await this.getScopedPlantOrThrow(
				params.scope,
				params.plantId,
			);

		// Get inverter serial numbers
		const inverters =
			await prisma.deviceInverter.findMany({
				where: {
					plantId: plant.id,
					deletedAt: null,
				},
				select: {
					serialNumber: true,
				},
			});

		const serialNumbers = inverters
			.map(
				(inv) => inv.serialNumber,
			)
			.filter(Boolean);

		// Aggregate all required values
		const aggregates =
			await prisma.deviceLogsLatest.aggregate({
				where: {
					sno: {
						in: serialNumbers,
					},
				},

				_sum: {
					currentPower: true,
					dailyProduction: true,
					totalEnergy: true,
					totalHours: true,
				},
			});

		// Latest timestamp
		const latestLog =
			await prisma.deviceLogsLatest.findFirst({
				where: {
					sno: {
						in: serialNumbers,
					},
				},

				orderBy: {
					latestTimestamp:
						'desc',
				},

				select: {
					latestTimestamp: true,
				},
			});

		const currentPower =
			Number(
				aggregates._sum
					.currentPower ?? 0,
			);

		const totalEToday =
			Number(
				aggregates._sum
					.dailyProduction ?? 0,
			);

		const totalETotal =
			Number(
				aggregates._sum
					.totalEnergy ?? 0,
			);

		const totalHTotal =
			Number(
				aggregates._sum
					.totalHours ?? 0,
			);

		const totalEnergyValue =
			totalETotal >= 1000
				? totalETotal / 1000
				: totalETotal;

		const totalEnergyUnit =
			totalETotal >= 1000
				? 'MWh'
				: 'kWh';

		return {
			plant: {
				id: String(plant.id),

				name: plant.name,

				type: plant.type,
			},

			metrics: {
				currentPower: {
					value: Number(
						currentPower.toFixed(
							2,
						),
					),

					unit: 'kW',

					dataType: 'live',
				},

				eToday: {
					value: Number(
						totalEToday.toFixed(
							2,
						),
					),

					unit: 'kWh',

					dataType: 'live',
				},

				eTotal: {
					value: Number(
						totalEnergyValue.toFixed(
							2,
						),
					),

					unit: totalEnergyUnit,

					dataType:
						'summary',
				},

				hTotal: {
					value: Number(
						totalHTotal.toFixed(
							2,
						),
					),

					unit: 'h',

					dataType:
						'summary',
				},

				capacity: {
					value: Number(
						(
							plant.kwp ?? 0
						).toFixed(2),
					),

					unit: 'kW',

					dataType:
						'configuration',
				},
			},

			lastUpdatedAt:
				latestLog?.latestTimestamp
					? this.formatDateTime(
						latestLog.latestTimestamp,
					)
					: null,
		};
	}

	async getPlantAnalysisDevices(params: PlantAnalysisDevicesParams) {
		const plant = await this.getScopedPlantOrThrow(params.scope, params.plantId);

		const devices = await prisma.deviceInverter.findMany({
			where: {
				plantId: plant.id,
				deletedAt: null,
			},
			select: {
				id: true,
				name: true,
				serialNumber: true,
				type: true,
				// online: true,
			},
			orderBy: {
				id: 'asc',
			},
		});

		return {
			totalDevices: devices.length,
			items: devices.map((device) => ({
				id: `device-${String(device.id)}`,
				name: device.name ?? `${device.type} ${device.serialNumber}`,
				sn: device.serialNumber,
				type: device.type,
				// online: device.online,
			})),
		};
	}

	async getPlantAnalysisParameters(params: PlantAnalysisParametersParams) {
		const plant = await this.getScopedPlantOrThrow(params.scope, params.plantId);
		const deviceId = this.parseDeviceIdOrThrow(params.deviceId);

		const device = await prisma.deviceInverter.findFirst({
			where: {
				id: deviceId,
				plantId: plant.id,
				deletedAt: null,
			},
			select: {
				id: true,
				serialNumber: true,
				type: true,
			},
		});

		if (!device) {
			throw new ApiError(404, 'Device not found for plant');
		}

		const catalog = this.getAnalysisParameterCatalog();
		const groups = Array.from(new Set(catalog.map((item) => item.group))).map((group) => ({
			label: group,
			parameters: catalog
				.filter((item) => item.group === group)
				.map((item) => ({
					key: item.key,
					label: item.label,
					unit: item.unit,
					axis: item.axis,
				})),
		}));

		return {
			device: {
				id: `device-${String(device.id)}`,
				sn: device.serialNumber,
				type: device.type,
			},
			groups,
		};
	}

	// async getPlantAnalysis(params: PlantAnalysisParams) {
	// 	const plant = await this.getScopedPlantOrThrow(params.scope, params.plantId);
	// 	const deviceId = this.parseDeviceIdOrThrow(params.deviceId);

	// 	const device = await prisma.deviceInverter.findFirst({
	// 		where: {
	// 			id: deviceId,
	// 			plantId: plant.id,
	// 			deletedAt: null,
	// 		},
	// 		select: {
	// 			id: true,
	// 			name: true,
	// 			serialNumber: true,
	// 			type: true,
	// 			// powerValue: true,
	// 		},
	// 	});

	// 	if (!device) {
	// 		throw new ApiError(404, 'Device not found for plant');
	// 	}

	// 	const catalog = this.getAnalysisParameterCatalog();
	// 	const selectedParameters = params.parameters
	// 		.map((key) => key.trim())
	// 		.filter((key, index, array) => key.length > 0 && array.indexOf(key) === index)
	// 		.map((key) => catalog.find((item) => item.key === key))
	// 		.filter((item): item is (typeof catalog)[number] => Boolean(item))
	// 		.map((item) => ({
	// 			key: item.key,
	// 			label: item.label,
	// 			group: item.group,
	// 			unit: item.unit,
	// 			axis: item.axis,
	// 		}));

	// 	if (selectedParameters.length === 0) {
	// 		throw new ApiError(400, 'No valid analysis parameters selected');
	// 	}

	// 	const baseDateTime = new Date(`${params.date}T07:00:00.000Z`);
	// 	// const points: Array<Record<string, string | number>> = [0, 1].map((offsetIndex) => {
	// 	// 	const pointTime = new Date(baseDateTime.getTime() + offsetIndex * 15 * 60 * 1000);
	// 	// 	const point: Record<string, string | number> = {
	// 	// 		time: pointTime.toISOString().slice(11, 16),
	// 	// 	};

	// 	// 	for (const parameter of selectedParameters) {
	// 	// 		const baseValue = this.getAnalysisValueByKey(parameter.key, device.powerValue);
	// 	// 		const value = baseValue + offsetIndex * (parameter.key === 'Pac1' ? 0.1 : parameter.key === 'Iac1' ? 0.2 : 1);
	// 	// 		point[parameter.key] = Number(value.toFixed(2));
	// 	// 	}

	// 	// 	return point;
	// 	// });

	// 	return {
	// 		date: params.date,
	// 		interval: params.interval,
	// 		device: {
	// 			id: `device-${String(device.id)}`,
	// 			name: device.name ?? `${device.type} ${device.serialNumber}`,
	// 			sn: device.serialNumber,
	// 			type: device.type,
	// 		},
	// 		selectedParameters,
	// 		// points,
	// 	};
	// }

	async getPlantChart(params: PlantChartParams) {
		const { devices } =
			await this.getChartContext(
				params.scope,
				params.plantId,
			);

		// const baseDate =
		// 	this.parseRangeDate(
		// 		params.range,
		// 		params.date,
		// 	);

		// console.log({
		// 	date: params.date,
		// 	range: params.range,
		// 	baseDate,
		// 	baseDateType: typeof baseDate,
		// });

		const baseDate =
			new Date(params.date);

		if (
			isNaN(
				baseDate.getTime(),
			)
		) {
			throw new ApiError(
				400,
				'Invalid date',
			);
		}


		const series =
			this.buildChartSeries(
				params.mode,
				devices,
			);

		const serialNumbers =
			devices.map(
				(device) =>
					device.serialNumber,
			);

		let points: Array<
			Record<string, string | number>
		> = [];

		/* ---------------- DAY ---------------- */

		if (params.range === 'day') {
			const logs =
				await prisma.deviceLogs.findMany({
					where: {
						sno: {
							in: serialNumbers,
						},
						timestamp: {
							gte: new Date(
								`${params.date}T00:00:00`,
							),
							lte: new Date(
								`${params.date}T23:59:59.999`,
							),
						},
					},
					orderBy: {
						timestamp: 'asc',
					},
				});

			points = logs.map((log) => {
				const point: Record<
					string,
					string | number
				> = {
					time: this.formatDateTime(
						log.timestamp,
					),
				};

				if (
					params.mode === 'total'
				) {
					point.total = Number(
						log.total_input_power ??
						0,
					);

					return point;
				}

				const loggerIndex =
					devices.findIndex(
						(device) =>
							device.serialNumber ===
							log.sno,
					);

				point[
					`inverter${loggerIndex + 1
					}`
				] = Number(
					log.total_input_power ??
					0,
				);

				return point;
			});
		}

		/* ---------------- MONTH ---------------- */

		else if (
			params.range === 'month'
		) {
			const latestLogs =
				await prisma.deviceLogsLatest.findMany({
					where: {
						sno: {
							in: serialNumbers,
						},
						dayDate: {
							gte: new Date(
								baseDate.getFullYear(),
								baseDate.getMonth(),
								1,
							),
							lte: new Date(
								baseDate.getFullYear(),
								baseDate.getMonth() + 1,
								0,
							),
						},
					},
					orderBy: {
						dayDate: 'asc',
					},
				});
			console.log({
				baseDate,
				latestLogsCount: latestLogs.length,
				firstLog: latestLogs[0],
			});

			const daysInMonth =
				new Date(
					baseDate.getFullYear(),
					baseDate.getMonth() + 1,
					0,
				).getDate();



			points = Array.from(
				{
					length: daysInMonth,
				},
				(_, index) => {
					const day =
						index + 1;

					const dayLogs =
						latestLogs.filter(
							(log) =>
								new Date(
									log.dayDate,
								).getDate() === day,
						);


					const point: Record<
						string,
						string | number
					> = {
						time: `Day ${day}`,
					};

					if (
						params.mode ===
						'total'
					) {
						point.total =
							dayLogs.reduce(
								(sum, log) =>
									sum +
									(log.dailyProduction ??
										0),
								0,
							);

						return point;
					}

					devices.forEach(
						(
							device,
							index,
						) => {
							const row =
								dayLogs.find(
									(log) =>
										log.sno ===
										device.serialNumber,
								);

							point[
								`inverter${index + 1
								}`
							] =
								row?.dailyProduction ??
								0;
						},
					);


					return point;
				},
			);
		}

		/* ---------------- YEAR ---------------- */

		else {
			const latestLogs =
				await prisma.deviceLogsLatest.findMany({
					where: {
						sno: {
							in: serialNumbers,
						},
						dayDate: {
							gte: new Date(
								baseDate.getFullYear(),
								0,
								1,
							),
							lte: new Date(
								baseDate.getFullYear(),
								11,
								31,
							),
						},
					},
				});

			const months = [
				'Jan',
				'Feb',
				'Mar',
				'Apr',
				'May',
				'Jun',
				'Jul',
				'Aug',
				'Sep',
				'Oct',
				'Nov',
				'Dec',
			];

			points = months.map(
				(
					month,
					monthIndex,
				) => {
					const point: Record<
						string,
						string | number
					> = {
						time: month,
					};

					const monthLogs =
						latestLogs.filter(
							(log) => {
								const istDate =
									new Date(
										new Date(
											log.dayDate,
										).toLocaleString(
											'en-US',
											{
												timeZone:
													'Asia/Kolkata',
											},
										),
									);

								return (
									istDate.getMonth() ===
									monthIndex
								);
							},
						);


					if (
						params.mode ===
						'total'
					) {
						point.total =
							monthLogs.reduce(
								(sum, log) =>
									sum +
									(log.dailyProduction ??
										0),
								0,
							);


						return point;
					}

					devices.forEach(
						(
							device,
							index,
						) => {
							point[
								`inverter${index + 1
								}`
							] =
								monthLogs
									.filter(
										(log) =>
											log.sno ===
											device.serialNumber,
									)
									.reduce(
										(sum, log) =>
											sum +
											(log.dailyProduction ??
												0),
										0,
									);
						},
					);

					return point;
				},
			);
		}

		return {
			chartType:
				params.range === 'day'
					? 'area'
					: 'bar',
			range: params.range,
			mode: params.mode,
			unit:
				params.range === 'day'
					? 'kW'
					: 'kWh',
			series,
			points,
		};
	}

	async exportPlantChart(params: PlantChartExportParams) {
		const chart = await this.getPlantChart(params);
		const fileName = 'plant-chart.csv';


		const headers = ['time', ...chart.series.map((item) => item.key)];
		const rows = [headers.join(',')];

		for (const point of chart.points as Array<Record<string, string | number>>) {
			rows.push(headers.map((header) => String(point[header] ?? '')).join(','));
		}

		const query = new URLSearchParams({
			range: params.range,
			mode: params.mode,
			date: params.date,
		});

		if (params.scope.length) {
			query.set(
				'scope',
				params.scope.join(','),
			);
		}

		if (params.fromService) {
			query.set(
				'fromService',
				'true',
			);
		}

		if (params.targetEndUserId) {
			query.set(
				'targetEndUserId',
				params.targetEndUserId,
			);
		}

		return {
			fileName,
			csv: rows.join('\n'),
			downloadUrl: `/api/v1/monitor/plants/${params.plantId}/chart/export/files/${fileName}?${query.toString()}`,
			expiresAt: new Date(
				Date.now() + 15 * 60 * 1000,
			).toISOString(),
		};
	}

	async getPlantAnalysis(params: PlantAnalysisParams) {
		console.log('getPlantAnalysis scope =>', params.scope);
		console.log('getPlantAnalysis plantId =>', params.plantId);
		const plant = await this.getScopedPlantOrThrow(
			params.scope,
			params.plantId,
		);

		const deviceId = this.parseDeviceIdOrThrow(
			params.deviceId,
		);

		const device = await prisma.deviceInverter.findFirst({
			where: {
				id: deviceId,
				plantId: plant.id,
				deletedAt: null,
			},
			select: {
				id: true,
				name: true,
				serialNumber: true,
				type: true,
			},
		});

		if (!device) {
			throw new ApiError(
				404,
				'Device not found for plant',
			);
		}

		const catalog = this.getAnalysisParameterCatalog();

		const selectedParameters = params.parameters
			.map((key) => key.trim())
			.filter(
				(key, index, array) =>
					key.length > 0 &&
					array.indexOf(key) === index,
			)
			.map((key) =>
				catalog.find(
					(item) => item.key === key,
				),
			)
			.filter(
				(item): item is (typeof catalog)[number] =>
					Boolean(item),
			)
			.map((item) => ({
				key: item.key,
				label: item.label,
				group: item.group,
				unit: item.unit,
				axis: item.axis,
			}));

		if (selectedParameters.length === 0) {
			throw new ApiError(
				400,
				'No valid analysis parameters selected',
			);
		}

		const startDate = new Date(
			`${params.date}T00:00:00`,
		);

		const endDate = new Date(
			`${params.date}T23:59:59.999`,
		);

		const logs = await prisma.deviceLogs.findMany({
			where: {
				sno: device.serialNumber,
				timestamp: {
					gte: startDate,
					lte: endDate,
				},
			},
			orderBy: {
				timestamp: 'asc',
			},
		});

		const points = logs.map((log) => {
			const point: Record<
				string,
				string | number | null
			> = {
				time: this.formatDateTime(log.timestamp)
			};

			for (const parameter of selectedParameters) {
				let value:
					| number
					| bigint
					| null
					| undefined;

				if (
					parameter.key.startsWith(
						'Voltage',
					)
				) {
					const index =
						parameter.key.replace(
							'Voltage',
							'',
						);

					value =
						log[
						`dc_voltage_${index}` as keyof typeof log
						] as number | null;

				} else if (
					parameter.key.startsWith(
						'Current',
					)
				) {
					const index =
						parameter.key.replace(
							'Current',
							'',
						);

					value =
						log[
						`dc_current_${index}` as keyof typeof log
						] as number | null;

				} else if (
					parameter.key.startsWith(
						'Power',
					)
				) {
					const index =
						parameter.key.replace(
							'Power',
							'',
						);

					value =
						log[
						`dc_power_${index}` as keyof typeof log
						] as bigint | null;
				}

				point[parameter.key] =
					typeof value === 'bigint'
						? Number(value)
						: (value ?? null);
			}

			return point;
		});

		return {
			date: params.date,
			interval: params.interval,
			device: {
				id: `device-${String(device.id)}`,
				name:
					device.name ??
					`${device.type} ${device.serialNumber}`,
				sn: device.serialNumber,
				type: device.type,
			},
			selectedParameters,
			points,
		};
	}

	// async getPlantChart(params: PlantChartParams) {
	// 	const { plant, devices } = await this.getChartContext(params.scope, params.plantId);
	// 	const baseDate = this.parseRangeDate(params.range, params.date);
	// 	const series = this.buildChartSeries(params.mode, devices);
	// 	const buckets = this.buildChartBuckets(params.range, baseDate);

	// 	const points = buckets.map((bucket, bucketIndex) => {
	// 		const point: Record<string, string | number> = { time: bucket };

	// 		if (params.mode === 'total') {
	// 			const seed = plant.powerValue || devices.reduce((sum, device) => sum + (device.powerValue || 0), 0);
	// 			point.total = this.buildChartValue(seed, bucketIndex, params.range);
	// 			return point;
	// 		}

	// 		devices.forEach((device, index) => {
	// 			const key = `logger${index + 1}`;
	// 			point[key] = this.buildChartValue(device.powerValue || (index + 1), bucketIndex, params.range);
	// 		});

	// 		return point;
	// 	});

	// 	return {
	// 		chartType: params.range === 'day' ? 'area' : 'bar',
	// 		range: params.range,
	// 		mode: params.mode,
	// 		unit: params.range === 'day' ? 'kW' : 'kWh',
	// 		series,
	// 		points,
	// 	};
	// }

	// async exportPlantChart(params: PlantChartExportParams) {
	// 	const chart = await this.getPlantChart(params);
	// 	const fileName = 'plant-chart.csv';

	// 	const headers = ['time', ...chart.series.map((item) => item.key)];
	// 	const rows = [headers.join(',')];

	// 	for (const point of chart.points as Array<Record<string, string | number>>) {
	// 		rows.push(headers.map((header) => String(point[header] ?? '')).join(','));
	// 	}

	// 	return {
	// 		fileName,
	// 		csv: rows.join('\n'),
	// 		downloadUrl: `/api/v1/monitor/plants/${params.plantId}/chart/export/files/${fileName}?range=${params.range}&mode=${params.mode}&date=${encodeURIComponent(params.date)}${params.scope.length ? `&scope=${encodeURIComponent(params.scope.join(','))}` : ''}`,
	// 		expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
	// 	};
	// }

	async getPlantCurrentAlerts(params: PlantCurrentAlertsParams) {
		const { plant, devices } = await this.getCurrentAlertsContext(params.scope, params.plantId);

		const alerts = devices
			.map((device) => {
				const statusLabel = this.normalizeStatusLabel((device as { status?: string | null }).status ?? null, (device as { online?: boolean }).online ?? false);

				if (statusLabel === 'online' || statusLabel === 'active') {
					return null;
				}

				return {
					id: `alert-${String(device.id)}`,
					name: device.name ?? device.type,
					sn: device.serialNumber,
					event: this.buildAlertEvent(statusLabel),
					severity: this.buildAlertSeverity(statusLabel),
					status: 'active',
					startedAt: this.formatDateTime((device as { updatedAt?: Date | null }).updatedAt ?? plant.lastUpdatedAt),
					lastUpdatedAt: this.formatDateTime((device as { updatedAt?: Date | null }).updatedAt ?? plant.lastUpdatedAt),
				};
			})
			.filter((item): item is NonNullable<typeof item> => Boolean(item));

		const totalItems = alerts.length;
		const totalPages = totalItems > 0 ? Math.ceil(totalItems / params.pageSize) : 0;
		const safePage = totalPages > 0 ? Math.min(params.page, totalPages) : 1;
		const start = (safePage - 1) * params.pageSize;
		const items = alerts.slice(start, start + params.pageSize);

		const summary = {
			active: alerts.length,
			critical: alerts.filter((item) => item.severity === 'critical').length,
			warning: alerts.filter((item) => item.severity === 'warning').length,
		};

		return {
			items,
			pagination: {
				page: totalItems > 0 ? safePage : 1,
				pageSize: params.pageSize,
				totalItems,
				totalPages,
			},
			summary: params.since ? summary : undefined,
		};
	}

	async listPlantInverterSerials(
		plantId: bigint,
	) {
		return prisma.deviceInverter.findMany({
			where: {
				plantId,
				deletedAt: null,
			},

			select: {
				serialNumber: true,
			},
		});
	}

	async getLatestTelemetryBySerials(
		serialNumbers: string[],
	) {
		const rows =
			await prisma.deviceLogsLatest.findMany({
				where: {
					sno: {
						in: serialNumbers,
					},
				},

				select: {
					sno: true,
					currentPower: true,
					totalEnergy: true,
					totalHours: true,
					latestTimestamp: true,
					updatedAt: true,
				},

				orderBy: [
					{
						sno: 'asc',
					},
					{
						latestTimestamp: 'desc',
					},
				],
			});

		const latestRows =
			new Map();

		for (const row of rows) {
			if (!latestRows.has(row.sno)) {
				latestRows.set(
					row.sno,
					row,
				);
			}
		}

		return Array.from(
			latestRows.values(),
		);
	}

	async findPlantInformationById(
		plantId: string,
	) {
		return prisma.plant.findFirst({
			where: {
				id: BigInt(plantId),
				deletedAt: null,
			},

			select: {
				id: true,
				userAccount: true,
				installed: true,
				address: true,
				kwp: true,
				latitude: true,
				longitude: true,
				price: true,
				lastUpdatedAt: true,
			},
		});
	}

	async listPlantDataloggers(plantId: string) {
		return prisma.deviceDatalogger.findMany({
			where: {
				plantId: BigInt(plantId),
				deletedAt: null,
			},
			select: {
				id: true,
				serialNumber: true,
				updatedAt: true,
			},
			orderBy: {
				id: 'asc',
			},
		});
	}

	async listPlantInverterTelemetry(plantId: string) {
		return prisma.deviceInverter.findMany({
			where: {
				plantId: BigInt(plantId),
				deletedAt: null,
			},
			// select: {
			// 	powerValue: true,
			// 	eTotalValue: true,
			// 	eTodayValue: true,
			// 	online: true,
			// 	updatedAt: true,
			// },
		});
	}

	async findDataloggerBySerialNumber(serialNumber: string) {
		return prisma.deviceDatalogger.findUnique({
			where: {
				serialNumber,
			},
			select: {
				id: true,
				plantId: true,
				deletedAt: true,
			},
		});
	}

	async createPlantLogger(plantId: string, serialNumber: string) {
		return prisma.deviceDatalogger.create({
			data: {
				plantId: BigInt(plantId),
				serialNumber,
				type: 'datalogger',
				name: `Datalogger ${serialNumber}`,
				online: false,
				status: 'offline',
			},
			select: {
				id: true,
				serialNumber: true,
				createdAt: true,
			},
		});
	}

	async restorePlantLogger(dataloggerId: bigint, plantId: string, serialNumber: string) {
		return prisma.deviceDatalogger.update({
			where: {
				id: dataloggerId,
			},
			data: {
				plantId: BigInt(plantId),
				serialNumber,
				deletedAt: null,
				name: `Datalogger ${serialNumber}`,
				online: false,
				status: 'offline',
				updatedAt: new Date(),
			},
			select: {
				id: true,
				serialNumber: true,
				updatedAt: true,
			},
		});
	}

	// async getPlantList(params: PlantListParams) {
	// 	const { scope, search, status, page, pageSize, sortBy = 'updatedAt', sortOrder = 'desc' } = params;

	// 	if (!scope || scope.length === 0) {
	// 		throw new ApiError(403, 'Unauthorized access to plants');
	// 	}

	// 	const filters: any = {
	// 		userAccount: { in: scope },
	// 		deletedAt: null,
	// 	};

	// 	if (search && search.trim()) {
	// 		filters.OR = [
	// 			{ name: { contains: search, mode: 'insensitive' } },
	// 			{ serialNumber: { contains: search, mode: 'insensitive' } },
	// 		];
	// 	}

	// 	if (status && status !== 'All') {
	// 		const statusMap: Record<string, string> = {
	// 			Normal: 'Online',
	// 			Abnormal: 'Abnormal',
	// 			Standby: 'Standby',
	// 			Offline: 'Offline',
	// 		};
	// 		filters.status = statusMap[status] || status;
	// 	}

	// 	try {
	// 		const [plants, total] = await Promise.all([
	// 			prisma.plant.findMany({
	// 				where: filters,
	// 				skip: (page - 1) * pageSize,
	// 				take: pageSize,
	// 				orderBy: { [sortBy]: sortOrder },
	// 				select: {
	// 					id: true,
	// 					userAccount: true,
	// 					name: true,
	// 					type: true,
	// 					// eTodayValue: true,
	// 					// eTodayUnit: true,
	// 					// eTotalValue: true,
	// 					// eTotalUnit: true,
	// 					// powerValue: true,
	// 					// powerUnit: true,
	// 					// effect: true,
	// 					installed: true,
	// 					lastUpdatedAt: true,
	// 					// status: true,
	// 				},
	// 			}),
	// 			prisma.plant.count({ where: filters }),
	// 		]);

	// 		// const statusCountsRaw = await prisma.plant.groupBy({
	// 		// 	by: ['status'],
	// 		// 	_count: { id: true },
	// 		// 	where: { userAccount: { in: scope }, deletedAt: null },
	// 		// });

	// 		// const statusCounts: Record<string, number> = {
	// 		// 	All: total,
	// 		// 	Normal: 0,
	// 		// 	Abnormal: 0,
	// 		// 	Standby: 0,
	// 		// 	Offline: 0,
	// 		// };

	// 		// statusCountsRaw.forEach((count) => {
	// 		// 	if (count.status === 'Online') statusCounts.Normal = count._count.id;
	// 		// 	else if (count.status === 'Abnormal') statusCounts.Abnormal = count._count.id;
	// 		// 	else if (count.status === 'Standby') statusCounts.Standby = count._count.id;
	// 		// 	else if (count.status === 'Offline') statusCounts.Offline = count._count.id;
	// 		// });

	// 		const items = plants.map((plant) => ({
	// 			id: String(plant.id),
	// 			ownerUserId: plant.userAccount,
	// 			name: plant.name,
	// 			type: plant.type,
	// 			// eToday: {
	// 			// 	value: plant.eTodayValue || 0,
	// 			// 	unit: plant.eTodayUnit || 'Wh',
	// 			// },
	// 			// eTotal: {
	// 			// 	value: plant.eTotalValue || 0,
	// 			// 	unit: plant.eTotalUnit || 'kWh',
	// 			// },
	// 			// power: {
	// 			// 	value: plant.powerValue || 0,
	// 			// 	unit: plant.powerUnit || 'W',
	// 			// },
	// 			// effect: plant.effect || '0',
	// 			installed: plant.installed ? plant.installed.toISOString().split('T')[0] : null,
	// 			updated: plant.lastUpdatedAt
	// 				? plant.lastUpdatedAt.toISOString().replace('T', ' ').split('.')[0]
	// 				: new Date().toISOString().replace('T', ' ').split('.')[0],
	// 			// status: plant.status === 'Online' ? 'Normal' : plant.status,
	// 			statusCount: 1,
	// 			matched: {
	// 				plantName: plant.name,
	// 				serialNumber: '',
	// 			},
	// 		}));

	// 		return {
	// 			items,
	// 			// statusCounts,
	// 			pagination: {
	// 				page,
	// 				pageSize,
	// 				totalItems: total,
	// 				totalPages: Math.ceil(total / pageSize),
	// 			},
	// 		};
	// 	} catch (error) {
	// 		console.error('Error fetching plant list:', error);
	// 		throw new ApiError(500, 'Failed to fetch plant list');
	// 	}
	// }

	async getPlantList(params: PlantListParams) {
		const {
			user,
			scope,
			selectedEndUserId,
			search,
			page,
			pageSize,
		} = params;

		if (!scope?.length) {
			throw new ApiError(
				403,
				'Unauthorized access to plants',
			);
		}

		let userAccountFilter: any = {
			in: scope,
		};

		if (
			selectedEndUserId &&
			user.role &&
			["service_super_admin", "service_admin"].includes(user.role)
		) {
			const endUser = await prisma.user.findUnique({
				where: {
					id: BigInt(selectedEndUserId),
				},
				select: {
					account: true,
				},
			});

			if (!endUser) {
				throw new ApiError(
					404,
					"Selected end user not found"
				);
			}

			userAccountFilter = endUser.account;
		}

		const filters: any = {
			userAccount: userAccountFilter,
			deletedAt: null,
		};

		try {
			// fetch plants first
			const plants =
				await prisma.plant.findMany({
					where: filters,

					select: {
						id: true,
						userAccount: true,
						name: true,
						type: true,
						price: true,
						priceUnit: true,
						kwp: true,
						installed: true,
						longitude: true,
						latitude: true,
						address: true,
					},
				});

			const total =
				plants.length;

			const plantIds =
				plants.map(
					(p) => p.id,
				);

			// fetch inverters
			const inverters =
				await prisma.deviceInverter.findMany({
					where: {
						plantId: {
							in: plantIds,
						},
						deletedAt: null,
					},

					select: {
						plantId: true,
						serialNumber: true,
					},
				});

			const plantSerialMap =
				new Map<
					string,
					string[]
				>();

			inverters.forEach(
				(inv) => {
					const key =
						String(
							inv.plantId,
						);

					if (
						!plantSerialMap.has(
							key,
						)
					) {
						plantSerialMap.set(
							key,
							[],
						);
					}

					plantSerialMap
						.get(key)!
						.push(
							inv.serialNumber,
						);
				},
			);

			const serials =
				inverters.map(
					(
						i,
					) =>
						i.serialNumber,
				);

			// get ALL logs ordered by newest timestamp first
			const logs =
				await prisma.deviceLogsLatest.findMany({
					where: {
						sno: {
							in: serials,
						},
					},

					orderBy: [
						{
							sno: 'asc',
						},
						{
							latestTimestamp:
								'desc',
						},
					],

					select: {
						sno: true,

						dailyProduction:
							true,

						totalEnergy:
							true,

						currentPower:
							true,

						latestTimestamp:
							true,
					},
				});

			// keep only latest row per inverter serial
			const logMap =
				new Map<
					string,
					typeof logs[number]
				>();

			for (const log of logs) {
				if (
					!logMap.has(
						log.sno,
					)
				) {
					logMap.set(
						log.sno,
						log,
					);
				}
			}

			let items =
				plants.map(
					(
						plant,
					) => {
						const serials =
							plantSerialMap.get(
								String(
									plant.id,
								),
							) ??
							[];

						let eToday = 0;

						let eTotal = 0;

						let power = 0;

						let latestUpdate:
							| Date
							| null =
							null;

						for (const serial of serials) {
							const log =
								logMap.get(
									serial,
								);

							if (!log)
								continue;

							eToday +=
								Number(
									log.dailyProduction ??
									0,
								);

							eTotal +=
								Number(
									log.totalEnergy ??
									0,
								);

							power +=
								Number(
									log.currentPower ??
									0,
								);

							if (
								log.latestTimestamp &&
								(!latestUpdate ||
									log.latestTimestamp >
									latestUpdate)
							) {
								latestUpdate =
									log.latestTimestamp;
							}
						}

						return {
							id: String(
								plant.id,
							),

							ownerUserId:
								plant.userAccount,

							name:
								plant.name,

							type:
								plant.type,

							price:
								plant.price,

							priceUnit:
								plant.priceUnit,

							kwp:
								plant.kwp,

							address:
								plant.address,

							latitude:
								plant.latitude,

							longitude:
								plant.longitude,

							eToday: {
								value:
									eToday,

								unit:
									'kWh',
							},

							eTotal: {
								value:
									eTotal,

								unit:
									eTotal >=
										1000
										? 'MWh'
										: 'kWh',
							},

							power: {
								value:
									power,

								unit:
									'kW',
							},

							installed:
								plant.installed
									? plant.installed
										.toISOString()
										.split(
											'T',
										)[0]
									: null,

							latestUpdate,

							updated: latestUpdate
								? this.formatDateTime(latestUpdate)
								: plant.installed
									? plant.installed.toISOString().split('T')[0]
									: null,
						};
					},
				);

			// newest inverter timestamp first
			items.sort(
				(
					a,
					b,
				) => {
					if (
						!a.latestUpdate
					)
						return 1;

					if (
						!b.latestUpdate
					)
						return -1;

					return (
						b.latestUpdate.getTime() -
						a.latestUpdate.getTime()
					);
				},
			);

			// paginate AFTER sorting
			const paginatedItems =
				items
					.slice(
						(page - 1) *
						pageSize,

						page *
						pageSize,
					)
					.map(
						({
							latestUpdate,
							...rest
						}) => rest,
					);

			return {
				items:
					paginatedItems,

				pagination: {
					page,

					pageSize,

					totalItems:
						total,

					totalPages:
						Math.ceil(
							total /
							pageSize,
						),
				},
			};
		} catch (err) {
			console.error(err);

			throw new ApiError(
				500,
				'Failed to fetch plant list',
			);
		}
	}

	async exportPlantList(
		user: User,
		scope: string[],
		fromService?: boolean,
		targetEndUserId?: string,
	) {
		const data =
			await this.getPlantList({
				user,
				scope,
				page: 1,
				pageSize: 100000,
			});

		const query = new URLSearchParams();

		if (fromService) {
			query.set('fromService', 'true');
		}

		if (targetEndUserId) {
			query.set(
				'targetEndUserId',
				targetEndUserId,
			);
		}

		return {
			fileName: 'plant-list.csv',

			downloadUrl:
				`/api/v1/monitor/plants/list/export/files/plant-list.csv${query.toString()
					? `?${query.toString()}`
					: ''
				}`,

			expiresAt: new Date(
				Date.now() + 15 * 60 * 1000,
			).toISOString(),

			items: data.items,
		};
	}

	// async getPlantSummary(params: PlantSummaryParams) {
	// 	const { scope, search } = params;

	// 	if (!scope || scope.length === 0) {
	// 		throw new ApiError(403, 'Unauthorized access to plants');
	// 	}

	// 	try {
	// 		const filters: any = {
	// 			userAccount: { in: scope },
	// 			deletedAt: null,
	// 		};

	// 		if (search && search.trim()) {
	// 			filters.OR = [
	// 				{ name: { contains: search, mode: 'insensitive' } },
	// 				{ serialNumber: { contains: search, mode: 'insensitive' } },
	// 			];
	// 		}

	// 		// const [metrics, statusCountsRaw, allPlants] = await Promise.all([
	// 		// 	prisma.plant.aggregate({
	// 		// 		// _sum: {
	// 		// 		// 	eTodayValue: true,
	// 		// 		// 	eTotalValue: true,
	// 		// 		// 	powerValue: true,
	// 		// 		// },
	// 		// 		where: filters,
	// 		// 	}),
	// 		// 	prisma.plant.groupBy({
	// 		// 		by: ['status'],
	// 		// 		_count: { id: true },
	// 		// 		where: filters,
	// 		// 	}),
	// 		// 	prisma.plant.findMany({
	// 		// 		where: filters,
	// 		// 		select: { id: true },
	// 		// 	}),
	// 		// ]);

	// 		// const statusCounts: Record<string, number> = {
	// 		// 	All: allPlants.length,
	// 		// 	Normal: 0,
	// 		// 	Abnormal: 0,
	// 		// 	Standby: 0,
	// 		// 	Offline: 0,
	// 		// };

	// 		// statusCountsRaw.forEach((count) => {
	// 		// 	if (count.status === 'Online') statusCounts.Normal = count._count.id;
	// 		// 	else if (count.status === 'Abnormal') statusCounts.Abnormal = count._count.id;
	// 		// 	else if (count.status === 'Standby') statusCounts.Standby = count._count.id;
	// 		// 	else if (count.status === 'Offline') statusCounts.Offline = count._count.id;
	// 		// });

	// 		return {
	// 			// currentPower: {
	// 			// 	value: metrics._sum?.powerValue || 0,
	// 			// 	unit: 'kW',
	// 			// },
	// 			// eToday: {
	// 			// 	value: metrics._sum?.eTodayValue || 0,
	// 			// 	unit: 'kWh',
	// 			// },
	// 			// eTotal: {
	// 			// 	value: metrics._sum?.eTotalValue || 0,
	// 			// 	unit: 'kWh',
	// 			// },
	// 			// hTotal: {
	// 			// 	value: 0,
	// 			// 	unit: 'Hrs',
	// 			// },
	// 			capacity: {
	// 				value: 0,
	// 				unit: 'kW',
	// 			},
	// 			// statusCounts,
	// 			listRefreshRequired: true,
	// 			changedPlantIds: [],
	// 			updatedAt: new Date().toISOString(),
	// 		};
	// 	} catch (error) {
	// 		console.error('Error fetching plant summary:', error);
	// 		throw new ApiError(500, 'Failed to fetch plant summary');
	// 	}
	// }

	async getPlantSummary(
		params: PlantSummaryParams,
	) {
		const { scope, search } = params;

		if (!scope?.length) {
			throw new ApiError(
				403,
				'Unauthorized access to plants',
			);
		}

		try {
			const filters: any = {
				userAccount: {
					in: scope,
				},
				deletedAt: null,
			};

			if (search?.trim()) {
				filters.OR = [
					{
						name: {
							contains: search,
							mode: 'insensitive',
						},
					},
				];
			}

			// plants
			const plants =
				await prisma.plant.findMany({
					where: filters,

					select: {
						id: true,
						kwp: true,
					},
				});

			const plantIds =
				plants.map(
					(p) => p.id,
				);

			if (!plantIds.length) {
				return {
					currentPower: {
						value: 0,
						unit: 'kW',
					},

					eToday: {
						value: 0,
						unit: 'kWh',
					},

					eTotal: {
						value: 0,
						unit: 'kWh',
					},

					hTotal: {
						value: 0,
						unit: 'h',
					},

					capacity: {
						value: 0,
						unit: 'kW',
					},

					listRefreshRequired: true,

					changedPlantIds: [],

					updatedAt:
						new Date().toISOString(),
				};
			}

			// inverters
			const inverters =
				await prisma.deviceInverter.findMany({
					where: {
						plantId: {
							in: plantIds,
						},
						deletedAt: null,
					},

					select: {
						serialNumber: true,
					},
				});

			const serialNumbers =
				inverters.map(
					(i) => i.serialNumber,
				);

			if (!serialNumbers.length) {
				return {
					currentPower: {
						value: 0,
						unit: 'kW',
					},

					eToday: {
						value: 0,
						unit: 'kWh',
					},

					eTotal: {
						value: 0,
						unit: 'kWh',
					},

					hTotal: {
						value: 0,
						unit: 'h',
					},

					capacity: {
						value: Number(
							plants
								.reduce(
									(sum, p) =>
										sum +
										(p.kwp ??
											0),
									0,
								)
								.toFixed(2),
						),
						unit: 'kW',
					},

					listRefreshRequired: true,

					changedPlantIds: [],

					updatedAt:
						new Date().toISOString(),
				};
			}

			// Get latest timestamp per inverter
			const latestPerInverter =
				await prisma.deviceLogsLatest.groupBy({
					by: ['sno'],

					where: {
						sno: {
							in: serialNumbers,
						},
					},

					_max: {
						latestTimestamp: true,
					},
				});

			const latestConditions =
				latestPerInverter
					.filter(
						(item) =>
							item._max
								.latestTimestamp,
					)
					.map((item) => ({
						sno: item.sno,
						latestTimestamp:
							item._max
								.latestTimestamp!,
					}));

			let latestLogs: Array<{
				currentPower: number | null;
				dailyProduction: number | null;
				totalEnergy: number | null;
				totalHours: number | null;
				latestTimestamp: Date | null;
			}> = [];

			if (latestConditions.length) {
				latestLogs =
					await prisma.deviceLogsLatest.findMany(
						{
							where: {
								OR: latestConditions,
							},

							select: {
								currentPower:
									true,
								dailyProduction:
									true,
								totalEnergy:
									true,
								totalHours:
									true,
								latestTimestamp:
									true,
							},
						},
					);
			}

			// Aggregate latest rows only
			const aggregates = latestLogs.reduce<{
				currentPower: number;
				dailyProduction: number;
				totalEnergy: number;
				totalHours: number;
				latestTimestamp: Date | null;
			}>(
				(acc, row) => {
					acc.currentPower += row.currentPower ?? 0;

					acc.dailyProduction +=
						row.dailyProduction ?? 0;

					acc.totalEnergy +=
						row.totalEnergy ?? 0;

					acc.totalHours +=
						row.totalHours ?? 0;

					if (
						!acc.latestTimestamp ||
						(row.latestTimestamp &&
							row.latestTimestamp >
							acc.latestTimestamp)
					) {
						acc.latestTimestamp =
							row.latestTimestamp;
					}

					return acc;
				},
				{
					currentPower: 0,
					dailyProduction: 0,
					totalEnergy: 0,
					totalHours: 0,
					latestTimestamp: null,
				},
			);

			const capacity =
				plants.reduce(
					(sum, p) =>
						sum + (p.kwp ?? 0),
					0,
				);

			const totalEnergy =
				aggregates.totalEnergy;

			return {
				currentPower: {
					value: Number(
						aggregates.currentPower.toFixed(
							2,
						),
					),

					unit: 'kW',
				},

				eToday: {
					value: Number(
						aggregates.dailyProduction.toFixed(
							2,
						),
					),

					unit: 'kWh',
				},

				eTotal: {
					value: Number(
						(
							totalEnergy >=
								1000
								? totalEnergy /
								1000
								: totalEnergy
						).toFixed(2),
					),

					unit:
						totalEnergy >=
							1000
							? 'MWh'
							: 'kWh',
				},

				hTotal: {
					value: Number(
						aggregates.totalHours.toFixed(
							2,
						),
					),

					unit: 'h',
				},

				capacity: {
					value: Number(
						capacity.toFixed(
							2,
						),
					),

					unit: 'kW',
				},

				listRefreshRequired: true,

				changedPlantIds: [],

				updatedAt: this.formatDateTime(
					aggregates.latestTimestamp,
				),
			};
		} catch (error) {
			console.error(error);

			throw new ApiError(
				500,
				'Failed to fetch plant summary',
			);
		}
	}

	async getLiveRows(params: LiveRowsParams) {
		const { scope, plantIds, status, page, pageSize } = params;

		if (!scope || scope.length === 0) {
			throw new ApiError(403, 'Unauthorized access to plants');
		}

		try {
			const plantIdNumbers = plantIds.map((id) => BigInt(id));

			const filters: any = {
				userAccount: { in: scope },
				deletedAt: null,
			};

			if (plantIds?.length > 0) {
				filters.id = {
					in: plantIds.map(
						(id) => BigInt(id),
					),
				};
			}

			if (status && status !== 'All') {
				const statusMap: Record<string, string> = {
					Normal: 'Online',
					Abnormal: 'Abnormal',
					Standby: 'Standby',
					Offline: 'Offline',
				};
				filters.status = statusMap[status] || status;
			}

			const plants = await prisma.plant.findMany({
				where: filters,
				skip: (page - 1) * pageSize,
				take: pageSize,
				select: {
					id: true,
					userAccount: true,
					// eTodayValue: true,
					// eTodayUnit: true,
					// eTotalValue: true,
					// eTotalUnit: true,
					// powerValue: true,
					// powerUnit: true,
					// effect: true,
					lastUpdatedAt: true,
					// status: true,
				},
			});

			const items = plants.map((plant) => ({
				id: String(plant.id),
				ownerUserId: plant.userAccount,
				// eToday: {
				// 	value: plant.eTodayValue || 0,
				// 	unit: plant.eTodayUnit || 'kWh',
				// },
				// eTotal: {
				// 	value: plant.eTotalValue || 0,
				// 	unit: plant.eTotalUnit || 'kWh',
				// },
				// power: {
				// 	value: plant.powerValue || 0,
				// 	unit: plant.powerUnit || 'kW',
				// },
				// effect: plant.effect || '0%',
				updated: plant.lastUpdatedAt
					? plant.lastUpdatedAt.toISOString().replace('T', ' ').split('.')[0]
					: new Date().toISOString().replace('T', ' ').split('.')[0],
				oldStatus: 'Offline',
				// status: plant.status === 'Online' ? 'Normal' : plant.status,
				statusCount: 1,
				rowStillMatchesActiveStatus: true,
			}));

			return {
				items,
				listRefreshRequired: false,
				updatedAt: new Date().toISOString(),
			};
		} catch (error) {
			console.error('Error fetching live rows:', error);
			throw new ApiError(500, 'Failed to fetch live rows');
		}
	}

	async getPlantDetails(scope: string[], plantId: string) {
		if (!scope || scope.length === 0) {
			throw new ApiError(403, 'Unauthorized access to plants');
		}

		try {
			const plantIdNum = BigInt(plantId);

			const plant = await prisma.plant.findUnique({
				where: { id: plantIdNum },
				select: {
					id: true,
					userAccount: true,
					name: true,
					type: true,
					installed: true,
					kwp: true,
					price: true,
					priceUnit: true,
					longitude: true,
					latitude: true,
					address: true,
					// status: true,
				},
			});

			if (!plant) {
				throw new ApiError(404, 'Plant not found');
			}

			if (!scope.includes(plant.userAccount)) {
				throw new ApiError(403, 'Unauthorized access to plant');
			}

			return {
				id: String(plant.id),
				ownerUserId: plant.userAccount,
				plantName: plant.name,
				plantType: plant.type,
				installedDate: plant.installed ? plant.installed.toISOString().split('T')[0] : null,
				kwp: plant.kwp || 0,
				price: plant.price || 0,
				priceUnit: plant.priceUnit || 'INR',
				longitude: plant.longitude || '',
				latitude: plant.latitude || '',
				address: plant.address || '',
				// status: plant.status,
			};
		} catch (error) {
			if (error instanceof ApiError) throw error;
			console.error('Error fetching plant details:', error);
			throw new ApiError(500, 'Failed to fetch plant details');
		}
	}

	async createPlant(user: User, scope: string[], plantData: any) {
		if (!scope || scope.length === 0) {
			throw new ApiError(403, 'Unauthorized access to create plant');
		}

		if (!user.account) {
			throw new ApiError(401, 'User account not found in token');
		}
		let plantOwnerAccount = user.account as string;

		if (plantData.selectedEndUserId) {
			const endUser = await prisma.user.findUnique({
				where: {
					id: BigInt(plantData.selectedEndUserId),
				},
				select: {
					account: true,
				},
			});

			if (!endUser) {
				throw new ApiError(404, "Selected end user not found");
			}

			plantOwnerAccount = endUser.account;
		}

		try {
			const newPlant = await prisma.plant.create({
				data: {
					name: plantData.plantName,
					type: plantData.plantType,
					userAccount: plantOwnerAccount,
					// userAccount: user.account as string,
					installed: plantData.installedDate ? new Date(plantData.installedDate) : null,
					kwp: plantData.kwp || null,
					price: plantData.price || null,
					priceUnit: plantData.priceUnit || null,
					longitude: plantData.longitude || null,
					latitude: plantData.latitude || null,
					address: plantData.address || null,
					pictureFileId: plantData.pictureFileId || null,
					// status: 'Offline',
				},
				select: {
					id: true,
					userAccount: true,
					createdAt: true,
				},
			});

			return {
				id: String(newPlant.id),
				ownerUserId: newPlant.userAccount,
				createdAt: newPlant.createdAt.toISOString(),
			};
		} catch (error) {
			console.error('Error creating plant:', error);
			throw new ApiError(500, 'Failed to create plant');
		}
	}

	async editPlant(scope: string[], plantId: string, plantData: any) {
		if (!scope || scope.length === 0) {
			throw new ApiError(403, 'Unauthorized access to edit plant');
		}

		try {
			const plantIdNum = BigInt(plantId);

			const plant = await prisma.plant.findUnique({
				where: { id: plantIdNum },
				select: { userAccount: true },
			});

			if (!plant) {
				throw new ApiError(404, 'Plant not found');
			}

			if (!scope.includes(plant.userAccount)) {
				throw new ApiError(403, 'Unauthorized access to edit plant');
			}

			const updatedPlant = await prisma.plant.update({
				where: { id: plantIdNum },
				data: {
					name: plantData.plantName,
					type: plantData.plantType,
					installed: plantData.installedDate ? new Date(plantData.installedDate) : undefined,
					kwp: plantData.kwp || null,
					price: plantData.price || null,
					priceUnit: plantData.priceUnit || null,
					longitude: plantData.longitude || null,
					latitude: plantData.latitude || null,
					address: plantData.address || null,
					pictureFileId: plantData.pictureFileId || null,
					updatedAt: new Date(),
				},
				select: {
					id: true,
					userAccount: true,
					updatedAt: true,
				},
			});

			return {
				id: String(updatedPlant.id),
				ownerUserId: updatedPlant.userAccount,
				updatedAt: updatedPlant.updatedAt.toISOString(),
			};
		} catch (error) {
			if (error instanceof ApiError) throw error;
			console.error('Error editing plant:', error);
			throw new ApiError(500, 'Failed to edit plant');
		}
	}

	async deletePlant(scope: string[], plantId: string) {
		if (!scope || scope.length === 0) {
			throw new ApiError(403, 'Unauthorized access to delete plant');
		}

		try {
			const plantIdNum = BigInt(plantId);

			const plant = await prisma.plant.findUnique({
				where: { id: plantIdNum },
				select: { userAccount: true },
			});

			if (!plant) {
				throw new ApiError(404, 'Plant not found');
			}

			if (!scope.includes(plant.userAccount)) {
				throw new ApiError(403, 'Unauthorized access to delete plant');
			}

			const deletedPlant = await prisma.plant.update({
				where: { id: plantIdNum },
				data: {
					// status: 'Offline',
					deletedAt: new Date(),
				},
				select: {
					id: true,
					userAccount: true,
					deletedAt: true,
				},
			});

			return {
				id: String(deletedPlant.id),
				ownerUserId: deletedPlant.userAccount,
				status: 'deleted',
				deletedAt: deletedPlant.deletedAt?.toISOString(),
			};
		} catch (error) {
			if (error instanceof ApiError) throw error;
			console.error('Error deleting plant:', error);
			throw new ApiError(500, 'Failed to delete plant');
		}
	}

	private buildLogEvent(status: string | null | undefined, online: boolean, type: string): string {
		const statusLabel = (status ?? '').toLowerCase();
		if (!online) {
			return 'Device offline';
		}
		if (statusLabel.includes('voltage')) {
			return 'A1-Grid under voltage';
		}
		if (statusLabel.includes('frequency')) {
			return 'A2-Grid under frequency';
		}
		if (statusLabel.includes('fault')) {
			return 'A3-Device fault';
		}
		return 'A4-Device event';
	}

	private buildLogStatus(online: boolean, statusLabel: string): string {
		if (!online) {
			return 'Inactive';
		}
		if (statusLabel.includes('fault')) {
			return 'Abnormal';
		}
		return 'Active';
	}

	private parsePlantIdOrThrow(plantId: string): bigint {
		if (!/^\d+$/.test(plantId)) {
			throw new ApiError(400, 'Invalid plant id');
		}

		return BigInt(plantId);
	}

	// private toDeviceSnapshotFromInverter(inverter: {
	// 	id: bigint;
	// 	name: string | null;
	// 	type: string;
	// 	serialNumber: string;
	// 	online: boolean;
	// 	status: string | null;
	// 	powerValue: number;
	// 	eTodayValue: number;
	// 	eTotalValue: number;
	// 	hTotalValue: number;
	// 	updatedAt: Date;
	// 	updateTime: Date | null;
	// }): PlantDeviceOverviewSnapshot {
	// 	return {
	// 		id: inverter.id,
	// 		name: inverter.name ?? `${inverter.type} ${inverter.serialNumber}`,
	// 		type: inverter.type,
	// 		sn: inverter.serialNumber,
	// 		online: inverter.online,
	// 		status: (inverter.status ?? '').toLowerCase(),
	// 		currentPowerKw: inverter.powerValue ?? 0,
	// 		todayEnergyKwh: inverter.eTodayValue ?? 0,
	// 		totalEnergyKwh: inverter.eTotalValue ?? 0,
	// 		totalHours: inverter.hTotalValue ?? 0,
	// 		lastUpdateAt: inverter.updateTime ?? inverter.updatedAt,
	// 	};
	// }

	// private toDeviceSnapshotFromDatalogger(datalogger: {
	// 	id: bigint;
	// 	name: string | null;
	// 	type: string;
	// 	serialNumber: string;
	// 	online: boolean;
	// 	status: string | null;
	// 	updatedAt: Date;
	// 	updateTime: Date | null;
	// 	inverter: {
	// 		powerValue: number;
	// 		eTodayValue: number;
	// 		eTotalValue: number;
	// 		hTotalValue: number;
	// 		updatedAt: Date;
	// 		updateTime: Date | null;
	// 	} | null;
	// }): PlantDeviceOverviewSnapshot {
	// 	const linkedInverter = datalogger.inverter;
	// 	const inverterUpdatedAt = linkedInverter?.updateTime ?? linkedInverter?.updatedAt;
	// 	const dataloggerUpdatedAt = datalogger.updateTime ?? datalogger.updatedAt;
	// 	const lastUpdateAt = inverterUpdatedAt && inverterUpdatedAt > dataloggerUpdatedAt ? inverterUpdatedAt : dataloggerUpdatedAt;

	// 	return {
	// 		id: datalogger.id,
	// 		name: datalogger.name ?? `${datalogger.type} ${datalogger.serialNumber}`,
	// 		type: datalogger.type,
	// 		sn: datalogger.serialNumber,
	// 		online: datalogger.online,
	// 		status: (datalogger.status ?? '').toLowerCase(),
	// 		currentPowerKw: linkedInverter?.powerValue ?? 0,
	// 		todayEnergyKwh: linkedInverter?.eTodayValue ?? 0,
	// 		totalEnergyKwh: linkedInverter?.eTotalValue ?? 0,
	// 		totalHours: linkedInverter?.hTotalValue ?? 0,
	// 		lastUpdateAt,
	// 	};
	// }

	// async getPlantDeviceOverviewSnapshot(params: PlantDeviceOverviewParams): Promise<PlantDeviceOverviewSnapshot> {
	// 	const plantIdNum = this.parsePlantIdOrThrow(params.plantId);
	// 	const deviceIdNum = this.parseDeviceIdOrThrow(params.deviceId);

	// 	const plantExists = await prisma.plant.findFirst({
	// 		where: {
	// 			id: plantIdNum,
	// 			deletedAt: null,
	// 		},
	// 		select: {
	// 			id: true,
	// 		},
	// 	});

	// 	if (!plantExists) {
	// 		throw new ApiError(404, 'Plant not found.');
	// 	}

	// 	const inverter = await prisma.deviceInverter.findFirst({
	// 		where: {
	// 			id: deviceIdNum,
	// 			plantId: plantIdNum,
	// 			deletedAt: null,
	// 		},
	// 		select: {
	// 			id: true,
	// 			name: true,
	// 			type: true,
	// 			serialNumber: true,
	// 			// online: true,
	// 			// status: true,
	// 			// powerValue: true,
	// 			// eTodayValue: true,
	// 			// eTotalValue: true,
	// 			// hTotalValue: true,
	// 			updatedAt: true,
	// 			updateTime: true,
	// 		},
	// 	});

	// 	if (inverter) {
	// 		return this.toDeviceSnapshotFromInverter(inverter);
	// 	}

	// 	const datalogger = await prisma.deviceDatalogger.findFirst({
	// 		where: {
	// 			id: deviceIdNum,
	// 			plantId: plantIdNum,
	// 			deletedAt: null,
	// 		},
	// 		select: {
	// 			id: true,
	// 			name: true,
	// 			type: true,
	// 			serialNumber: true,
	// 			online: true,
	// 			status: true,
	// 			updatedAt: true,
	// 			updateTime: true,
	// 			inverter: {
	// 				// select: {
	// 				// 	powerValue: true,
	// 				// 	eTodayValue: true,
	// 				// 	eTotalValue: true,
	// 				// 	hTotalValue: true,
	// 				// 	updatedAt: true,
	// 				// 	updateTime: true,
	// 				// },
	// 			},
	// 		},
	// 	});

	// 	if (!datalogger) {
	// 		throw new ApiError(404, 'Device not found for this plant.');
	// 	}

	// 	return this.toDeviceSnapshotFromDatalogger(datalogger);
	// }

	async getPlantLogs(params: PlantLogsParams) {
		const plant = await this.getScopedPlantOrThrow(params.scope, params.plantId);
		const dateFromObj = params.dateFrom ? new Date(`${params.dateFrom}T00:00:00.000Z`) : new Date('2025-01-01T00:00:00.000Z');
		const dateToObj = params.dateTo ? new Date(`${params.dateTo}T23:59:59.999Z`) : new Date();

		const [inverters, dataloggers] = await Promise.all([
			prisma.deviceInverter.findMany({
				where: {
					plantId: plant.id,
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
				},
				orderBy: { id: 'asc' },
			}),
			prisma.deviceDatalogger.findMany({
				where: {
					plantId: plant.id,
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
				},
				orderBy: { id: 'asc' },
			}),
		]);

		const allDevices = [
			...inverters.map((inv) => ({
				id: String(inv.id),
				name: inv.name ?? `${inv.type} ${inv.serialNumber}`,
				type: inv.type,
				sn: inv.serialNumber,
				online: null,
				status: null,
				updatedAt: inv.updatedAt,
			})),
			...dataloggers.map((log) => ({
				id: String(log.id),
				name: log.name ?? `${log.type} ${log.serialNumber}`,
				type: log.type,
				sn: log.serialNumber,
				online: log.online,
				status: log.status,
				updatedAt: log.updatedAt,
			})),
		];

		let logs: PlantLogRecord[] = allDevices
			.filter((device) => {
				if (params.search && params.search.trim()) {
					const searchLower = params.search.toLowerCase();
					return device.name.toLowerCase().includes(searchLower) || device.sn.toLowerCase().includes(searchLower);
				}
				return true;
			})
			.map((device) => ({
				id: `log-${device.id}`,
				name: device.name,
				type: device.type,
				sn: device.sn,
				time: this.formatDateTime(device.updatedAt),
				// status: this.buildLogStatus(device.online, device.status ?? ''),
				// event: this.buildLogEvent(device.status, device.online, device.type),
			}))
		// .filter((log) => {
		// 	if (params.event && params.event !== 'All') {
		// 		return log.event === params.event || log.event.startsWith(`${params.event}-`);
		// 	}
		// 	return true;
		// });

		const totalItems = logs.length;
		const totalPages = totalItems > 0 ? Math.ceil(totalItems / params.pageSize) : 0;
		const safePage = totalPages > 0 ? Math.min(params.page, totalPages) : 1;
		const start = (safePage - 1) * params.pageSize;

		return {
			items: logs.slice(start, start + params.pageSize),
			pagination: {
				page: totalItems > 0 ? safePage : 1,
				pageSize: params.pageSize,
				totalItems,
				totalPages,
			},
		};
	}

	async exportPlantLogs(params: PlantLogsExportParams) {
		const plant = await this.getScopedPlantOrThrow(params.scope, params.plantId);

		const [inverters, dataloggers] = await Promise.all([
			prisma.deviceInverter.findMany({
				where: {
					plantId: plant.id,
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
				},
			}),
			prisma.deviceDatalogger.findMany({
				where: {
					plantId: plant.id,
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
				},
			}),
		]);

		const allDevices = [
			...inverters.map((inv) => ({
				id: String(inv.id),
				name: inv.name ?? `${inv.type} ${inv.serialNumber}`,
				type: inv.type,
				sn: inv.serialNumber,
				// online: inv.online,
				// status: inv.status,
				updatedAt: inv.updatedAt,
			})),
			...dataloggers.map((log) => ({
				id: String(log.id),
				name: log.name ?? `${log.type} ${log.serialNumber}`,
				type: log.type,
				sn: log.serialNumber,
				online: log.online,
				status: log.status,
				updatedAt: log.updatedAt,
			})),
		];

		const logs = allDevices
			.filter((device) => {
				if (params.search && params.search.trim()) {
					const searchLower = params.search.toLowerCase();
					return device.name.toLowerCase().includes(searchLower) || device.sn.toLowerCase().includes(searchLower);
				}
				return true;
			})
			.map((device) => ({
				id: `log-${device.id}`,
				name: device.name,
				type: device.type,
				sn: device.sn,
				time: this.formatDateTime(device.updatedAt),
				// status: this.buildLogStatus(device.online, device.status ?? ''),
				// event: this.buildLogEvent(device.status, device.online, device.type),
				// event: this.buildLogEvent(device.status, device.online, device.type),
			}))
		// .filter((log) => {
		// 	if (params.event && params.event !== 'All') {
		// 		return log.event === params.event || log.event.startsWith(`${params.event}-`);
		// 	}
		// 	return true;
		// });

		if (params.format === 'csv') {
			const headers = ['ID', 'Name', 'Type', 'S/N', 'Time', 'Status', 'Event'];
			const rows = [headers.join(',')];
			for (const log of logs) {
				rows.push(
					[
						log.id,
						`"${log.name.replace(/"/g, '""')}"`,
						log.type,
						log.sn,
						log.time,
						// log.status,
						// log.event,
					].join(','),
				);
			}

			const fileName = 'plant-logs.csv';
			return {
				fileName,
				csv: rows.join('\n'),
				downloadUrl: `/api/v1/monitor/plants/${params.plantId}/logs/export/files/${fileName}`,
				expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
			};
		}

		throw new ApiError(400, `Unsupported export format: ${params.format}`);
	}

	async getUserLogs(params: UserLogsParams) {
		const dateFromObj = params.dateFrom
			? new Date(`${params.dateFrom}T00:00:00.000Z`)
			: new Date('2025-01-01T00:00:00.000Z');

		const dateToObj = params.dateTo
			? new Date(`${params.dateTo}T23:59:59.999Z`)
			: new Date();

		const plants = await prisma.plant.findMany({
			where: {
				userAccount: {
					in: params.scope,
				},
				deletedAt: null,
			},
			select: {
				id: true,
				name: true,
				user: {
					select: {
						account: true,
					},
				},
			},
		});

		const plantMap = new Map(
			plants.map((plant) => [
				plant.id.toString(),
				{
					plantName: plant.name,
					account: plant.user.account,
				},
			])
		);

		const plantIds = plants.map((plant) => plant.id);

		console.log('plants =>', plants.length);
		console.log(plants);

		const inverters = await prisma.deviceInverter.findMany({
			where: {
				plantId: {
					in: plantIds,
				},
				deletedAt: null,
			},
			select: {
				id: true,
				plantId: true,
				serialNumber: true,
				updatedAt: true,
				type: true
			},
		});

		console.log('inverters =>', inverters.length);
		console.log(inverters.slice(0, 5));

		let logs = inverters.map((inv) => {
			const plantInfo = plantMap.get(inv.plantId.toString());

			return {
				id: `inv-${inv.id}`,
				name: plantInfo?.plantName ?? '',
				account: plantInfo?.account ?? '',
				type: inv.type,
				sn: inv.serialNumber,
				time: this.formatDateTime(inv.updatedAt),
				status: 'Active',
				event: '',
				updatedAt: inv.updatedAt,
			};
		});

		if (params.search?.trim()) {
			const search = params.search.toLowerCase();

			logs = logs.filter(
				(log) =>
					log.name.toLowerCase().includes(search) ||
					log.account.toLowerCase().includes(search) ||
					log.sn.toLowerCase().includes(search)
			);
		}

		const totalItems = logs.length;
		const totalPages =
			totalItems > 0
				? Math.ceil(totalItems / params.pageSize)
				: 0;

		const safePage =
			totalPages > 0
				? Math.min(params.page, totalPages)
				: 1;

		const start = (safePage - 1) * params.pageSize;

		return {
			items: logs
				.slice(start, start + params.pageSize)
				.map(({ updatedAt, ...log }) => log),

			pagination: {
				page: totalItems > 0 ? safePage : 1,
				pageSize: params.pageSize,
				totalItems,
				totalPages,
			},
		};
	}
}