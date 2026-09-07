import { prisma, type PrismaClient } from '@/server/db/prisma';
import { ApiError } from '@/server/utils/api-error';

// The one piece of logic every remote-setting tab genuinely shares:
// confirming the caller's scope covers this plant, then resolving the
// device id to a real, non-deleted inverter within it. Kept in one place
// deliberately — this is a security check, so it should have exactly one
// source of truth rather than being copy-pasted into six tab repositories.

export interface ScopedInverter {
	id: bigint;
	serialNumber: string;
	macAddress: string;
}

function parseDeviceId(deviceId: string): bigint {
	const normalized = deviceId.startsWith('device-')
		? deviceId.slice('device-'.length)
		: deviceId;

	if (!/^\d+$/.test(normalized)) {
		throw new ApiError(400, 'Invalid device id');
	}

	return BigInt(normalized);
}

export async function getScopedInverterOrThrow(
	dbClient: PrismaClient,
	scope: string[],
	sn: string,
): Promise<ScopedInverter> {
	if (!scope || scope.length === 0) {
		throw new ApiError(403, 'Unauthorized access to plant devices');
	}

	const inverter = await dbClient.deviceInverter.findFirst({
		where: {
			serialNumber: sn,
			deletedAt: null,
		},
		select: {
			id: true,
			serialNumber: true,
			plantId: true,
		},
	});

	console.log('[REMOTE SETTINGS] SN lookup:', {
		requestedSn: sn,
		inverter,
	});

	if (!inverter) {
		throw new ApiError(
			404,
			'Device not found. Remote settings are only available for inverters.',
		);
	}

	console.log('[REMOTE SETTINGS] Inverter Found', {
		id: inverter.id.toString(),
		serialNumber: inverter.serialNumber,
	});

	const latestLog = await dbClient.deviceLogsLatest.findFirst({
		where: {
			sno: inverter.serialNumber,
		},
		orderBy: {
			latestTimestamp: 'desc',
		},
		select: {
			macAddress: true,
		},
	});

	console.log('[REMOTE SETTINGS] Latest Log', {
		sno: inverter.serialNumber,
		macAddress: latestLog?.macAddress,
	});

	if (!latestLog?.macAddress) {
		throw new ApiError(
			404,
			'MAC address not found for this inverter.',
		);
	}

	console.log('[REMOTE SETTINGS] Final Device', {
		id: inverter.id.toString(),
		serialNumber: inverter.serialNumber,
		macAddress: latestLog.macAddress,
	});

	return {
		id: inverter.id,
		serialNumber: inverter.serialNumber,
		macAddress: latestLog.macAddress,
	};
}

export { prisma };
