import { DeviceRepository, type AddPlantInverterParams, type DeviceChartContextParams, type DeviceChartSnapshot, type DeviceCurrentAlertsSnapshot, type DeviceCurrentAlertsSnapshotParams, type DeviceDeleteParams, type DeviceEditParams, type DeviceInformationSnapshot, type DeviceInformationSnapshotParams, type DeviceListParams, type DeviceLiveRowsParams, type DeviceViewParams } from '@/server/repositories/device.repository';
import { ApiError } from '@/server/utils/api-error';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { UserRepository } from '@/server/repositories/user.repository';


export interface DeviceChartServiceParams {
	user: User;
	plantId: string;
	deviceId: string;
	date?: string;
	month?: number;
	year?: number;
	range: 'day' | 'month' | 'year';
	fromService?: boolean;
	targetEndUserId?: string;
}

export interface DeviceChartExportServiceParams extends DeviceChartServiceParams {
	format: 'csv';
}

export interface DeviceCurrentAlertsServiceParams {
	user: User;
	plantId: string;
	deviceId: string;
	status: 'active';
	page: number;
	pageSize: number;
	since?: string;
	sortBy: 'name' | 'sn' | 'event' | 'severity' | 'startedAt' | 'lastUpdatedAt';
	sortOrder: 'asc' | 'desc';
	fromService?: boolean;
	targetEndUserId?: string;
}

export interface DeviceInformationServiceParams {
	user: User;
	plantId: string;
	deviceId: string;
	dateFrom?: string;
	dateTo?: string;
	fromService?: boolean;
	targetEndUserId?: string;
}

export interface DeviceInformationLiveServiceParams {
	user: User;
	plantId: string;
	deviceId: string;
	since?: string;
	fromService?: boolean;
	targetEndUserId?: string;
}

export interface DeviceInformationExportServiceParams {
	user: User;
	plantId: string;
	deviceId: string;
	dateFrom: string;
	dateTo: string;
	format: 'csv';
	fromService?: boolean;
	targetEndUserId?: string;
}

export interface DeviceLogsServiceParams {
	user: User;
	plantId: string;
	deviceId: string;
	page: number;
	pageSize: number;
	search: string;
	event: string;
	dateFrom: string;
	dateTo: string;
	sortBy: 'name' | 'type' | 'sn' | 'time' | 'status' | 'event';
	sortOrder: 'asc' | 'desc';
	fromService?: boolean;
	targetEndUserId?: string;
}

export interface DeviceLogsExportServiceParams {
	user: User;
	plantId: string;
	deviceId: string;
	search: string;
	event: string;
	dateFrom: string;
	dateTo: string;
	sortBy: 'name' | 'type' | 'sn' | 'time' | 'status' | 'event';
	sortOrder: 'asc' | 'desc';
	format: 'csv';
	fromService?: boolean;
	targetEndUserId?: string;
}

export class DeviceService {
	constructor(private readonly deviceRepository: DeviceRepository = new DeviceRepository()) { }

	private formatDateTime(value: Date | null | undefined): string {
		const date = value ?? new Date();
		const iso = date.toISOString();
		return iso.replace('T', ' ').slice(0, 19);
	}

	private readonly userRepository = new UserRepository();

	private async resolveScope(
		user: User,
		fromService?: boolean,
		targetEndUserId?: string,
	): Promise<string[]> {
		const baseScope = await resolveUserScope(user);

		const hasServiceRole =
			user.role === 'service_admin' ||
			user.role === 'service_super_admin';

		if (
			fromService &&
			hasServiceRole &&
			targetEndUserId
		) {
			const userRepository = new UserRepository();

			const accountScope =
				await userRepository.getAccountScopeByUserId(
					targetEndUserId,
				);

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

	private assertPlantAccess(scope: string[], account: string) {
		if (!scope || scope.length === 0) {
			throw new ApiError(403, 'Unauthorized access to plants');
		}

		if (!scope.includes(account)) {
			throw new ApiError(403, 'You do not have access to this device.');
		}
	}

	private normalizeStatusLabel(status: string | null | undefined, online: boolean): string {
		if (!status) {
			return online ? 'online' : 'offline';
		}

		return status.toLowerCase();
	}

	private buildAlertSeverity(statusLabel: string): 'critical' | 'warning' {
		if (statusLabel.includes('offline') || statusLabel.includes('fault')) {
			return 'critical';
		}

		return 'warning';
	}

	private buildAlertEvent(statusLabel: string): string {
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

	private toAlertDateTime(value: Date): string {
		return value.toISOString().replace('T', ' ').slice(0, 19);
	}

	// private toCurrentAlertItems(snapshot: DeviceCurrentAlertsSnapshot) {
	// 	const statusLabel = this.normalizeStatusLabel(snapshot.device.status, snapshot.device.online);

	// 	if (statusLabel === 'online' || statusLabel === 'active') {
	// 		return [] as Array<{
	// 			id: string;
	// 			name: string;
	// 			sn: string;
	// 			event: string;
	// 			severity: 'critical' | 'warning';
	// 			status: 'active';
	// 			startedAt: string;
	// 			lastUpdatedAt: string;
	// 		}>;
	// 	}

	// 	const updatedAt = this.toAlertDateTime(snapshot.device.updatedAt);
	// 	return [
	// 		{
	// 			id: `alert-${String(snapshot.device.id)}`,
	// 			name: snapshot.device.name,
	// 			sn: snapshot.device.sn,
	// 			event: this.buildAlertEvent(statusLabel),
	// 			severity: this.buildAlertSeverity(statusLabel),
	// 			status: 'active' as const,
	// 			startedAt: updatedAt,
	// 			lastUpdatedAt: updatedAt,
	// 		},
	// 	];
	// }

	private filterLiveRefreshItems<T extends { lastUpdatedAt: string }>(
		items: T[],
		since?: string,
	): T[] {
		if (!since) {
			return items;
		}

		const sinceDate = new Date(since);
		if (Number.isNaN(sinceDate.getTime())) {
			throw new ApiError(400, 'Invalid since timestamp');
		}

		return items.filter((item) => new Date(item.lastUpdatedAt).getTime() > sinceDate.getTime());
	}

	private sortCurrentAlertItems(
		items: Array<{ name: string; sn: string; event: string; severity: string; startedAt: string; lastUpdatedAt: string }>,
		sortBy: DeviceCurrentAlertsServiceParams['sortBy'],
		sortOrder: DeviceCurrentAlertsServiceParams['sortOrder'],
	) {
		const multiplier = sortOrder === 'asc' ? 1 : -1;
		return [...items].sort((left, right) => {
			if (sortBy === 'name') return left.name.localeCompare(right.name) * multiplier;
			if (sortBy === 'sn') return left.sn.localeCompare(right.sn) * multiplier;
			if (sortBy === 'event') return left.event.localeCompare(right.event) * multiplier;
			if (sortBy === 'severity') return left.severity.localeCompare(right.severity) * multiplier;
			if (sortBy === 'startedAt') return (new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime()) * multiplier;
			return (new Date(left.lastUpdatedAt).getTime() - new Date(right.lastUpdatedAt).getTime()) * multiplier;
		});
	}

	private createDayPoints(
		logs: Array<{
			timestamp: Date;
			total_input_power:
			bigint | null;
		}>,
	) {
		return logs.map(
			(log) => ({
				time:
					this.formatDateTime(
						log.timestamp,
					),

				total: Number(
					log.total_input_power ??
					0,
				),
			}),
		);
	}

	private resolveDeviceStatus(online: boolean, status: string | null): 'online' | 'offline' | 'abnormal' {
		if (!online) {
			return 'offline';
		}

		const normalized = (status ?? '').toLowerCase();
		if (normalized.includes('fault') || normalized.includes('abnormal')) {
			return 'abnormal';
		}

		return 'online';
	}

	private formatInfoDateTime(value: Date): string {
		return value.toISOString().replace('T', ' ').slice(0, 19);
	}

	private validateDateRange(dateFrom?: string, dateTo?: string) {
		if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) {
			throw new ApiError(400, 'dateFrom and dateTo must be provided together');
		}

		if (!dateFrom || !dateTo) {
			return;
		}

		const from = new Date(`${dateFrom}T00:00:00.000Z`);
		const to = new Date(`${dateTo}T00:00:00.000Z`);
		if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
			throw new ApiError(400, 'Invalid date range');
		}

		if (from > to) {
			throw new ApiError(400, 'dateFrom must be less than or equal to dateTo');
		}
	}

	private resolveRangeFactor(dateFrom?: string, dateTo?: string): number {
		if (!dateFrom || !dateTo) {
			return 1;
		}

		const from = new Date(`${dateFrom}T00:00:00.000Z`);
		const to = new Date(`${dateTo}T00:00:00.000Z`);
		const diffDays = Math.max(1, Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1);
		return Math.max(0.65, 1 - Math.min(30, diffDays) * 0.01);
	}

	// private toDeviceInformationData(snapshot: DeviceInformationSnapshot, dateFrom?: string, dateTo?: string) {
	// 	const factor = this.resolveRangeFactor(dateFrom, dateTo);
	// 	const outputPower = snapshot.device.powerValue * factor;
	// 	const mppt1Voltage = Number((720 + outputPower * 0.35).toFixed(2));
	// 	const mppt1Current = Number((8 + outputPower * 0.05).toFixed(2));
	// 	const mppt1Power = Number((mppt1Voltage * mppt1Current / 1000).toFixed(2));
	// 	const mppt2Voltage = Number((mppt1Voltage * 0.98).toFixed(2));
	// 	const mppt2Current = Number((mppt1Current * 1.02).toFixed(2));
	// 	const mppt2Power = Number((mppt2Voltage * mppt2Current / 1000).toFixed(2));

	// 	const l1Voltage = Number((248 + outputPower * 0.1).toFixed(2));
	// 	const l1Current = Number((60 + outputPower * 0.3).toFixed(2));
	// 	const l2Voltage = Number((l1Voltage - 0.6).toFixed(2));
	// 	const l2Current = Number((l1Current - 0.07).toFixed(2));
	// 	const l3Voltage = Number((l1Voltage - 0.9).toFixed(2));
	// 	const l3Current = Number((l1Current - 0.4).toFixed(2));

	// 	const temperature = Math.round(40 + outputPower * 0.3);
	// 	const signal = snapshot.device.online ? '80' : '0';
	// 	const communicationModuleStatus = snapshot.device.online ? 'Online' : 'Offline';
	// 	const communicationModuleVersion = `026200-08_${String(1607 + Number(snapshot.device.id % BigInt(100))).padStart(6, '0')}`;

	// 	const basicStats = [
	// 		{ key: 'mppt1', label: 'MPPT1', value: `${mppt1Voltage.toFixed(2)} V / ${mppt1Current.toFixed(2)} A / ${mppt1Power.toFixed(2)} kW` },
	// 		{ key: 'mppt2', label: 'MPPT2', value: `${mppt2Voltage.toFixed(2)} V / ${mppt2Current.toFixed(2)} A / ${mppt2Power.toFixed(2)} kW` },
	// 		{ key: 'l1', label: 'L1', value: `${l1Voltage.toFixed(2)} V / ${l1Current.toFixed(2)} A` },
	// 		{ key: 'l2', label: 'L2', value: `${l2Voltage.toFixed(2)} V / ${l2Current.toFixed(2)} A` },
	// 		{ key: 'l3', label: 'L3', value: `${l3Voltage.toFixed(2)} V / ${l3Current.toFixed(2)} A` },
	// 		{ key: 'outputPower', label: 'Output Power', value: `${outputPower.toFixed(2)} kW` },
	// 		{ key: 'temperature', label: 'Temperature', value: `${temperature} 째C` },
	// 		{ key: 'signal', label: 'Signal', value: signal },
	// 		{ key: 'communicationModuleStatus', label: 'Communication Module Status', value: communicationModuleStatus },
	// 		{ key: 'communicationModuleSn', label: 'Communication Module SN', value: snapshot.device.communicationModuleSn },
	// 		{ key: 'communicationModuleVersion', label: 'Communication Module Version', value: communicationModuleVersion },
	// 	];

	// 	const stringStats = Array.from({ length: 4 }, (_, index) => {
	// 		const voltage = Number((mppt1Voltage - index * 4.5).toFixed(2));
	// 		const current = Number((Math.max(0, mppt1Current / 2 - index * 0.12)).toFixed(2));
	// 		return {
	// 			key: `string${index + 1}`,
	// 			label: `String${index + 1}`,
	// 			value: `${voltage.toFixed(2)} V / ${current.toFixed(2)} A`,
	// 		};
	// 	});

	// 	if (outputPower <= 0 && snapshot.device.eTodayValue <= 0) {
	// 		return {
	// 			device: {
	// 				id: `device-${String(snapshot.device.id)}`,
	// 				name: snapshot.device.name,
	// 				type: snapshot.device.type,
	// 				sn: snapshot.device.sn,
	// 				status: this.resolveDeviceStatus(snapshot.device.online, snapshot.device.status),
	// 			},
	// 			basicStats: [] as Array<{ key: string; label: string; value: string }>,
	// 			stringStats: [] as Array<{ key: string; label: string; value: string }>,
	// 			lastUpdatedAt: this.formatInfoDateTime(snapshot.device.updatedAt),
	// 		};
	// 	}

	// 	return {
	// 		device: {
	// 			id: `device-${String(snapshot.device.id)}`,
	// 			name: snapshot.device.name,
	// 			type: snapshot.device.type,
	// 			sn: snapshot.device.sn,
	// 			status: this.resolveDeviceStatus(snapshot.device.online, snapshot.device.status),
	// 		},
	// 		basicStats,
	// 		stringStats,
	// 		lastUpdatedAt: this.formatInfoDateTime(snapshot.device.updatedAt),
	// 	};
	// }

	// private toDeviceInformationLiveData(snapshot: DeviceInformationSnapshot, since?: string) {
	// 	const payload = this.toDeviceInformationData(snapshot);
	// 	if (!since) {
	// 		return {
	// 			device: {
	// 				id: payload.device.id,
	// 				status: payload.device.status,
	// 			},
	// 			basicStats: payload.basicStats,
	// 			stringStats: payload.stringStats,
	// 			lastUpdatedAt: payload.lastUpdatedAt,
	// 		};
	// 	}

	// 	const sinceDate = new Date(since);
	// 	if (Number.isNaN(sinceDate.getTime())) {
	// 		throw new ApiError(400, 'Invalid since timestamp');
	// 	}

	// 	if (snapshot.device.updatedAt <= sinceDate) {
	// 		return {
	// 			device: {
	// 				id: payload.device.id,
	// 				status: payload.device.status,
	// 			},
	// 			basicStats: [] as typeof payload.basicStats,
	// 			stringStats: [] as typeof payload.stringStats,
	// 			lastUpdatedAt: payload.lastUpdatedAt,
	// 		};
	// 	}

	// 	return {
	// 		device: {
	// 			id: payload.device.id,
	// 			status: payload.device.status,
	// 		},
	// 		basicStats: payload.basicStats,
	// 		stringStats: payload.stringStats,
	// 		lastUpdatedAt: payload.lastUpdatedAt,
	// 	};
	// }

	private toDeviceInformationData(
		snapshot: any,
		dateFrom?: string,
		dateTo?: string,
	) {
		const log = snapshot.log;
		const latestSummary = snapshot.latestSummary;

		if (!log) {
			return {
				device: {
					id: `device-${snapshot.device.id}`,
					name: snapshot.device.name,
					type: snapshot.device.type,
					sn: snapshot.device.serialNumber,
					// status: 'Offline',
				},
				basicStats: [],
				stringStats: [],
				lastUpdatedAt: null,
			};
		}

		const basicStats = [
			{
				key: 'mppt1',
				label: 'MPPT1',
				value: `${log.dc_voltage_1 ?? 0} V / ${log.dc_current_1 ?? 0} A / ${Number(log.dc_power_1 ?? 0)} kW`,
			},
			{
				key: 'mppt2',
				label: 'MPPT2',
				value: `${log.dc_voltage_2 ?? 0} V / ${log.dc_current_2 ?? 0} A / ${Number(log.dc_power_2 ?? 0)} kW`,
			},
			{
				key: 'mppt3',
				label: 'MPPT3',
				value: `${log.dc_voltage_3 ?? 0} V / ${log.dc_current_3 ?? 0} A / ${Number(log.dc_power_3 ?? 0)} kW`,
			},
			{
				key: 'mppt4',
				label: 'MPPT4',
				value: `${log.dc_voltage_4 ?? 0} V / ${log.dc_current_4 ?? 0} A / ${Number(log.dc_power_4 ?? 0)} kW`,
			},
			{
				key: 'mppt5',
				label: 'MPPT5',
				value: `${log.dc_voltage_5 ?? 0} V / ${log.dc_current_5 ?? 0} A / ${Number(log.dc_power_5 ?? 0)} kW`,
			},
			{
				key: 'mppt6',
				label: 'MPPT6',
				value: `${log.dc_voltage_6 ?? 0} V / ${log.dc_current_6 ?? 0} A / ${Number(log.dc_power_6 ?? 0)} kW`,
			},
			{
				key: 'mppt7',
				label: 'MPPT7',
				value: `${log.dc_voltage_7 ?? 0} V / ${log.dc_current_7 ?? 0} A / ${Number(log.dc_power_7 ?? 0)} kW`,
			},
			{
				key: 'mppt8',
				label: 'MPPT8',
				value: `${log.dc_voltage_8 ?? 0} V / ${log.dc_current_8 ?? 0} A / ${Number(log.dc_power_8 ?? 0)} kW`,
			},
			{
				key: 'mppt9',
				label: 'MPPT9',
				value: `${log.dc_voltage_9 ?? 0} V / ${log.dc_current_9 ?? 0} A / ${Number(log.dc_power_9 ?? 0)} kW`,
			},
			{
				key: 'l1',
				label: 'L1',
				value: `${log.ac_voltage_a ?? 0} V / ${log.ac_current_a ?? 0} A`,
			},
			{
				key: 'l2',
				label: 'L2',
				value: `${log.ac_voltage_b ?? 0} V / ${log.ac_current_b ?? 0} A`,
			},
			{
				key: 'l3',
				label: 'L3',
				value: `${log.ac_voltage_c ?? 0} V / ${log.ac_current_c ?? 0} A`,
			},
			{
				key: 'outputPower',
				label: 'Output Power',
				value: `${Number(log.total_input_power)} kW`,
			},
			{
				key: 'temperature',
				label: 'Temperature',
				value: `${log.temperature_1 ?? 0} 째C`,
			},
			{
				key: 'signal',
				label: 'Signal',
				value: String(log.signal_strength ?? 0),
			},
			{
				key: 'communicationModuleStatus',
				label: 'Communication Module Status',
				value: log.logger_status ?? '-',
			},
			{
				key: 'communicationModuleSn',
				label: 'Communication Module SN',
				value: log.sno ?? '-',
			},
			{
				key: 'communicationModuleVersion',
				label: 'Communication Module Version',
				value: log.module_version_no ?? '-',
			},
			{
				key: 'Model',
				label: 'Model',
				value: log.device_model ?? '-',
			},
			{
				key: 'SerialNumber',
				label: 'Serial Number',
				value: log.sno ?? '-',
			},
			{
				key: 'E-Today',
				label: 'E-Today',
				value: `${latestSummary?.dailyProduction ?? 0} kWh`,
			},
			{
				key: 'E-Total',
				label: 'E-Total',
				value: `${latestSummary?.totalEnergy ?? 0} kWh`,
			},
			{
				key: 'H-Total',
				label: 'H-Total',
				value: `${latestSummary?.totalHours ?? 0} h`,
			},
		];

		const stringStats = Array.from({ length: 9 }, (_, i) => ({
			key: `string${i + 1}`,
			label: `String${i + 1}`,
			value: `${log[`dc_voltage_${i + 1}`] ?? 0
				} V / ${log[`dc_current_${i + 1}`] ?? 0
				} A`,
		}));

		return {
			device: {
				id: `device-${snapshot.device.id}`,
				name: snapshot.device.name,
				type: snapshot.device.type,
				sn: snapshot.device.serialNumber,
				status: this.resolveDeviceStatus(
					true,
					String(log.inverter_status ?? ''),
				),
			},
			basicStats,
			stringStats,
			lastUpdatedAt: this.formatInfoDateTime(log.timestamp),
		};
	}

	private formatLogDateTime(value: Date): string {
		return value.toISOString().replace('T', ' ').slice(0, 19);
	}

	private toDeviceTypeLabel(type: string): string {
		return type.length > 0 ? `${type[0].toUpperCase()}${type.slice(1)}` : 'Device';
	}

	private generateDeviceLogs(
		snapshot: DeviceInformationSnapshot,
		dateFrom: string,
		dateTo: string,
	): Array<{ id: string; name: string; type: string; sn: string; time: string; status: string; event: string }> {
		const startDate = new Date(`${dateFrom}T00:00:00.000Z`);
		const endDate = new Date(`${dateTo}T23:59:59.999Z`);

		if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
			throw new ApiError(400, 'Invalid date range');
		}

		if (startDate > endDate) {
			throw new ApiError(400, 'dateFrom must be less than or equal to dateTo');
		}

		const events = [
			'Grid under voltage',
			'Grid under frequency',
			'Grid absent',
			'Device online',
			'Device alert',
		];
		const diffDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1);
		const totalCandidates = Math.min(200, Math.max(20, diffDays * 6));
		const rows: Array<{ id: string; name: string; type: string; sn: string; time: string; status: string; event: string }> = [];

		for (let index = 0; index < totalCandidates; index += 1) {
			const event = events[index % events.length];
			const logTime = new Date(endDate.getTime() - index * 4 * 60 * 60 * 1000);
			if (logTime < startDate) {
				break;
			}

			rows.push({
				id: `log-${String(snapshot.device.id)}-${index + 1}`,
				name: snapshot.device.name,
				type: this.toDeviceTypeLabel(snapshot.device.type),
				sn: snapshot.device.sn,
				time: this.formatLogDateTime(logTime),
				status: event === 'Device online' ? 'Active' : 'Inactive',
				event: "Inactive",
			});
		}

		return rows;
	}

	private applyDeviceLogFilters(
		rows: Array<{ id: string; name: string; type: string; sn: string; time: string; status: string; event: string }>,
		search: string,
		event: string,
	) {
		const normalizedSearch = search.trim().toLowerCase();

		return rows.filter((item) => {
			if (event !== 'All' && item.event !== event) {
				return false;
			}

			if (!normalizedSearch) {
				return true;
			}

			return item.name.toLowerCase().includes(normalizedSearch)
				|| item.sn.toLowerCase().includes(normalizedSearch);
		});
	}

	private sortDeviceLogs(
		rows: Array<{ id: string; name: string; type: string; sn: string; time: string; status: string; event: string }>,
		sortBy: DeviceLogsServiceParams['sortBy'],
		sortOrder: DeviceLogsServiceParams['sortOrder'],
	) {
		const multiplier = sortOrder === 'asc' ? 1 : -1;
		return [...rows].sort((left, right) => {
			if (sortBy === 'name') return left.name.localeCompare(right.name) * multiplier;
			if (sortBy === 'type') return left.type.localeCompare(right.type) * multiplier;
			if (sortBy === 'sn') return left.sn.localeCompare(right.sn) * multiplier;
			if (sortBy === 'status') return left.status.localeCompare(right.status) * multiplier;
			if (sortBy === 'event') return left.event.localeCompare(right.event) * multiplier;
			return (new Date(left.time).getTime() - new Date(right.time).getTime()) * multiplier;
		});
	}

	private async buildFilteredDeviceLogsData(params: {
		user: User;
		plantId: string;
		deviceId: string;
		search: string;
		event: string;
		dateFrom: string;
		dateTo: string;
		sortBy: DeviceLogsServiceParams['sortBy'];
		sortOrder: DeviceLogsServiceParams['sortOrder'];
		fromService?: boolean;
		targetEndUserId?: string;
	}) {
		this.validateDateRange(params.dateFrom, params.dateTo);

		const scope = await this.resolveScope(params.user, params.fromService, params.targetEndUserId);
		// console.log({
		// 	role: params.user.role,
		// 	fromService: params.fromService,
		// 	targetEndUserId: params.targetEndUserId,
		// 	scope,
		// });
		const snapshot = await this.deviceRepository.getDeviceInformationSnapshot({
			plantId: params.plantId,
			deviceId: params.deviceId,
		});
		this.assertPlantAccess(scope, snapshot.plantAccount);

		const allRows = this.generateDeviceLogs(snapshot, params.dateFrom, params.dateTo);
		const filtered = this.applyDeviceLogFilters(allRows, params.search, params.event);
		const sorted = this.sortDeviceLogs(filtered, params.sortBy, params.sortOrder);

		return {
			items: sorted,
			filters: {
				search: params.search,
				event: params.event,
				dateFrom: params.dateFrom,
				dateTo: params.dateTo,
			},
		};
	}

	private createMonthPoints(
		logs: Array<{
			dayDate: Date;
			dailyProduction: number | null;
			totalEnergy: number | null;
		}>,
	) {
		if (logs.length === 0) {
			return [];
		}

		const firstDate =
			new Date(logs[0].dayDate);

		const daysInMonth =
			new Date(
				firstDate.getFullYear(),
				firstDate.getMonth() + 1,
				0,
			).getDate();

		return Array.from(
			{
				length: daysInMonth,
			},
			(_, index) => {
				const day =
					index + 1;

				const row =
					logs.find(
						(log) =>
							new Date(
								log.dayDate,
							).getDate() === day,
					);

				return {
					date: String(day).padStart(
						2,
						'0',
					),

					total:
						row?.dailyProduction ??
						0,
				};
			},
		);
	}

	private createYearPoints(
		logs: Array<{
			latestTimestamp: Date;
			dailyProduction: number | null;
			totalEnergy: number | null;
		}>
	) {
		const monthTotals = new Map<number, number>();

		for (const log of logs) {
			const month =
				log.latestTimestamp.getMonth();

			const current =
				monthTotals.get(month) ?? 0;

			monthTotals.set(
				month,
				current +
				(log.dailyProduction ?? 0)
			);
		}

		return Array.from(
			{ length: 12 },
			(_, month) => ({
				month: new Date(
					2000,
					month,
					1
				).toLocaleString(
					'en-IN',
					{
						month: 'short',
					}
				),

				total: Number(
					(
						monthTotals.get(month) ?? 0
					).toFixed(2)
				),
			})
		);
	}

	private async toChartResponse(
		snapshot: DeviceChartSnapshot,
		params: Pick<
			DeviceChartServiceParams,
			'date' | 'range'
		>
	) {
		const device = {
			id: `device-${snapshot.device.id}`,
			name: snapshot.device.name,
			sn: snapshot.device.sn,
			type: snapshot.device.type,
		};

		const energySeries = [
			{
				key: 'total',
				label: 'Energy',
				unit: 'kWh',
				color: '#2f80ed',
			},
		];

		if (!params.date) {
			throw new ApiError(
				400,
				'Date is required'
			);
		}

		if (params.range === 'day') {
			const logs =
				await this.deviceRepository.getDeviceDayChartLogs({
					sno: snapshot.device.sn,
					date: params.date,
				});

			return {
				range: 'day' as const,
				chartType: 'area' as const,
				unit: 'kW' as const,

				period: {
					date: params.date,
				},


				device,

				series: [
					{
						key: 'total',
						label: 'Power',
						unit: 'kW',
						color: '#2f80ed',
					},
				],

				points: this.createDayPoints(logs),
			};
		}

		if (params.range === 'month') {
			const logs =
				await this.deviceRepository.getDeviceMonthChartLogs({
					sno: snapshot.device.sn,
					date: params.date,
				});

			const selectedDate =
				new Date(params.date);

			return {
				range: 'month' as const,
				chartType: 'bar' as const,
				unit: 'kWh' as const,

				period: {
					month:
						selectedDate.getMonth() + 1,
					year:
						selectedDate.getFullYear(),
				},

				device,

				series: energySeries,

				points:
					this.createMonthPoints(
						logs,
					),
			};
		}

		if (params.range === 'year') {
			const logs =
				await this.deviceRepository.getDeviceYearChartLogs({
					sno: snapshot.device.sn,
					date: params.date,
				});

			const selectedDate =
				new Date(params.date);

			return {
				range: 'year' as const,
				chartType: 'bar' as const,
				unit: 'kWh' as const,

				period: {
					year:
						selectedDate.getFullYear(),
				},

				device,

				series: energySeries,

				points: this.createYearPoints(logs),
			};
		}

		throw new ApiError(
			400,
			'Invalid chart range'
		);
	}

	getPlantDeviceList(params: DeviceListParams) {
		return this.deviceRepository.getPlantDeviceList(params);
	}

	getPlantDeviceLiveRows(params: DeviceLiveRowsParams) {
		return this.deviceRepository.getPlantDeviceLiveRows(params);
	}

	addPlantInverter(params: AddPlantInverterParams) {
		return this.deviceRepository.addPlantInverter(params);
	}

	getDeviceView(params: DeviceViewParams) {
		return this.deviceRepository.getDeviceView(params);
	}

	editDevice(params: DeviceEditParams) {
		return this.deviceRepository.editDevice(params);
	}

	deleteDevice(params: DeviceDeleteParams) {
		return this.deviceRepository.deleteDevice(params);
	}

	async getDeviceChart(params: DeviceChartServiceParams) {
		const scope = await this.resolveScope(params.user, params.fromService, params.targetEndUserId);
		// console.log("CHART_SCOPE", {
		// 	role: params.user.role,
		// 	fromService: params.fromService,
		// 	targetEndUserId: params.targetEndUserId,
		// 	scope,
		// });
		const repoParams: DeviceChartContextParams = {
			plantId: params.plantId,
			deviceId: params.deviceId,
		};

		const snapshot = await this.deviceRepository.getDeviceChartSnapshot(repoParams);
		// console.log("CHART_ACCOUNT", {
		// 	plantAccount: snapshot.plantAccount,
		// });
		this.assertPlantAccess(scope, snapshot.plantAccount);

		return this.toChartResponse(snapshot, {
			date: params.date,
			range: params.range,
		});
	}

	async exportDeviceChart(params: DeviceChartExportServiceParams) {
		const chart = await this.getDeviceChart(params);

		let headers: string[];

		switch (params.range) {
			case 'day':
				headers = ['time', 'total'];
				break;

			case 'month':
				headers = ['date', 'total'];
				break;

			case 'year':
				headers = ['month', 'total'];
				break;

			default:
				headers = ['total'];
		}

		const rows = [headers.join(',')];

		for (const point of chart.points as Array<Record<string, string | number>>) {
			rows.push(
				headers.map((header) => String(point[header] ?? '')).join(',')
			);
		}

		return {
			fileName: `device-chart-${params.deviceId}-${params.date}-${params.range}.csv`,
			downloadUrl: `/api/v1/monitor/devices/${params.deviceId}/chart/export/files/device-chart-${params.deviceId}-${params.date}-${params.range}.csv`,
			expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
			csv: rows.join('\n'),
		};
	}

	// async getDeviceCurrentAlerts(params: DeviceCurrentAlertsServiceParams) {
	// 	const scope = await this.resolveScope(params.user, params.fromService, params.targetEndUserId);
	// 	const repoParams: DeviceCurrentAlertsSnapshotParams = {
	// 		plantId: params.plantId,
	// 		deviceId: params.deviceId,
	// 	};

	// 	const snapshot = await this.deviceRepository.getDeviceCurrentAlertsSnapshot(repoParams);
	// 	this.assertPlantAccess(scope, snapshot.plantAccount);

	// 	const allItems = this.toCurrentAlertItems(snapshot);
	// 	const summary = {
	// 		active: allItems.length,
	// 		critical: allItems.filter((item) => item.severity === 'critical').length,
	// 		warning: allItems.filter((item) => item.severity === 'warning').length,
	// 	};

	// 	const liveItems = this.filterLiveRefreshItems(allItems, params.since);
	// 	const sortedItems = this.sortCurrentAlertItems(liveItems, params.sortBy, params.sortOrder);

	// 	const totalItems = sortedItems.length;
	// 	const totalPages = totalItems > 0 ? Math.ceil(totalItems / params.pageSize) : 0;
	// 	const safePage = totalPages > 0 ? Math.min(params.page, totalPages) : 1;
	// 	const start = (safePage - 1) * params.pageSize;
	// 	const items = sortedItems.slice(start, start + params.pageSize);

	// 	return {
	// 		items,
	// 		pagination: {
	// 			page: totalItems > 0 ? safePage : 1,
	// 			pageSize: params.pageSize,
	// 			totalItems,
	// 			totalPages,
	// 		},
	// 		summary,
	// 	};
	// }

	// async getDeviceInformation(params: DeviceInformationServiceParams) {
	// 	this.validateDateRange(params.dateFrom, params.dateTo);

	// 	const scope = await this.resolveScope(params.user, params.fromService, params.targetEndUserId);
	// 	const repoParams: DeviceInformationSnapshotParams = {
	// 		plantId: params.plantId,
	// 		deviceId: params.deviceId,
	// 	};

	// 	const snapshot = await this.deviceRepository.getDeviceInformationSnapshot(repoParams);

	// 	console.log("SNAPSHOT =", snapshot);
	// 	this.assertPlantAccess(scope, snapshot.plantAccount);

	// 	console.log("scope =", scope);
	// 	console.log("plantAccount =", snapshot?.plantAccount);

	// 	const payload = this.toDeviceInformationData(snapshot, params.dateFrom, params.dateTo);
	// 	if (params.dateFrom && params.dateTo) {
	// 		return {
	// 			device: {
	// 				id: payload.device.id,
	// 				sn: payload.device.sn,
	// 			},
	// 			dateRange: {
	// 				dateFrom: params.dateFrom,
	// 				dateTo: params.dateTo,
	// 			},
	// 			basicStats: payload.basicStats,
	// 			stringStats: payload.stringStats,
	// 			lastUpdatedAt: payload.lastUpdatedAt,
	// 		};
	// 	}

	// 	return payload;
	// }

	async getDeviceInformation(params: DeviceInformationServiceParams) {
		this.validateDateRange(params.dateFrom, params.dateTo);

		const scope = await this.resolveScope(params.user, params.fromService, params.targetEndUserId);
		const repoParams: DeviceInformationSnapshotParams = {
			plantId: params.plantId,
			deviceId: params.deviceId,
		};

		const snapshot =
			await this.deviceRepository.getDeviceInformationRealtimeSnapshot(
				repoParams,
			);

		if (!snapshot) {
			throw new Error('Device not found');
		}

		// console.log("SNAPSHOT =", snapshot);
		this.assertPlantAccess(scope, snapshot.plantAccount);

		// console.log("scope =", scope);
		// console.log("plantAccount =", snapshot?.plantAccount);

		const payload = this.toDeviceInformationData(snapshot, params.dateFrom, params.dateTo);
		if (params.dateFrom && params.dateTo) {
			return {
				device: {
					id: payload.device.id,
					sn: payload.device.sn,
				},
				dateRange: {
					dateFrom: params.dateFrom,
					dateTo: params.dateTo,
				},
				basicStats: payload.basicStats,
				stringStats: payload.stringStats,
				lastUpdatedAt: payload.lastUpdatedAt,
			};
		}

		return payload;
	}

	// async getDeviceInformationLive(params: DeviceInformationLiveServiceParams) {
	// 	const scope = await this.resolveScope(params.user, params.fromService, params.targetEndUserId);
	// 	const repoParams: DeviceInformationSnapshotParams = {
	// 		plantId: params.plantId,
	// 		deviceId: params.deviceId,
	// 	};

	// 	const snapshot = await this.deviceRepository.getDeviceInformationSnapshot(repoParams);
	// 	this.assertPlantAccess(scope, snapshot.plantAccount);

	// 	return this.toDeviceInformationLiveData(snapshot, params.since);
	// }

	async exportDeviceInformation(params: DeviceInformationExportServiceParams) {
		const information = await this.getDeviceInformation(params);

		const rows = ['section,key,label,value'];
		for (const item of information.basicStats) {
			rows.push(`basic,${item.key},${item.label},${item.value}`);
		}
		for (const item of information.stringStats) {
			rows.push(`string,${item.key},${item.label},${item.value}`);
		}


		return {
			fileName: `device-information-${params.deviceId}-${params.dateFrom}-to-${params.dateTo}.csv`,
			downloadUrl: `/api/v1/monitor/devices/${params.deviceId}/information/export/files/device-information-${params.deviceId}-${params.dateFrom}-to-${params.dateTo}.csv`,
			expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
			csv: rows.join('\n'),
		};
	}

	async getDeviceLogs(params: DeviceLogsServiceParams) {
		const result = await this.buildFilteredDeviceLogsData({
			user: params.user,
			plantId: params.plantId,
			deviceId: params.deviceId,
			search: params.search,
			event: params.event,
			dateFrom: params.dateFrom,
			dateTo: params.dateTo,
			sortBy: params.sortBy,
			sortOrder: params.sortOrder,
			fromService: params.fromService,
			targetEndUserId: params.targetEndUserId,
		});

		const totalItems = result.items.length;
		const totalPages = totalItems > 0 ? Math.ceil(totalItems / params.pageSize) : 0;
		const safePage = totalPages > 0 ? Math.min(params.page, totalPages) : 1;
		const start = (safePage - 1) * params.pageSize;

		return {
			items: result.items.slice(start, start + params.pageSize),
			pagination: {
				page: totalItems > 0 ? safePage : 1,
				pageSize: params.pageSize,
				totalItems,
				totalPages,
			},
			filters: result.filters,
		};
	}

	async exportDeviceLogs(params: DeviceLogsExportServiceParams) {
		const result = await this.buildFilteredDeviceLogsData({
			user: params.user,
			plantId: params.plantId,
			deviceId: params.deviceId,
			search: params.search,
			event: params.event,
			dateFrom: params.dateFrom,
			dateTo: params.dateTo,
			sortBy: params.sortBy,
			sortOrder: params.sortOrder,
			fromService: params.fromService,
			targetEndUserId: params.targetEndUserId,
		});

		const headers = ['id', 'name', 'type', 'sn', 'time', 'status', 'event'];
		const rows = [headers.join(',')];
		for (const item of result.items) {
			rows.push(headers.map((key) => String(item[key as keyof typeof item] ?? '')).join(','));
		}

		return {
			fileName: `device-logs-${params.deviceId}-${params.dateFrom}-to-${params.dateTo}.csv`,
			downloadUrl: `/api/v1/monitor/devices/${params.deviceId}/logs/export/files/device-logs-${params.deviceId}-${params.dateFrom}-to-${params.dateTo}.csv`,
			expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
			csv: rows.join('\n'),
		};
	}
}

const deviceService = new DeviceService();

export async function getPlantDeviceList(params: DeviceListParams) {
	return deviceService.getPlantDeviceList(params);
}

export async function getPlantDeviceLiveRows(params: DeviceLiveRowsParams) {
	return deviceService.getPlantDeviceLiveRows(params);
}

export async function addPlantInverter(params: AddPlantInverterParams) {
	return deviceService.addPlantInverter(params);
}

export async function getDeviceView(params: DeviceViewParams) {
	return deviceService.getDeviceView(params);
}

export async function editDevice(params: DeviceEditParams) {
	return deviceService.editDevice(params);
}

export async function deleteDevice(params: DeviceDeleteParams) {
	return deviceService.deleteDevice(params);
}

export async function getDeviceChart(params: DeviceChartServiceParams) {
	return deviceService.getDeviceChart(params);
}

export async function exportDeviceChart(params: DeviceChartExportServiceParams) {
	return deviceService.exportDeviceChart(params);
}

// export async function getDeviceCurrentAlerts(params: DeviceCurrentAlertsServiceParams) {
// 	return deviceService.getDeviceCurrentAlerts(params);
// }

export async function getDeviceInformation(params: DeviceInformationServiceParams) {
	return deviceService.getDeviceInformation(params);
}

// export async function getDeviceInformationLive(params: DeviceInformationLiveServiceParams) {
// 	return deviceService.getDeviceInformationLive(params);
// }

export async function exportDeviceInformation(params: DeviceInformationExportServiceParams) {
	return deviceService.exportDeviceInformation(params);
}

export async function getDeviceLogs(params: DeviceLogsServiceParams) {
	return deviceService.getDeviceLogs(params);
}

export async function exportDeviceLogs(params: DeviceLogsExportServiceParams) {
	return deviceService.exportDeviceLogs(params);
}