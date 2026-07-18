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
	plantId: string,
	deviceId: string,
): Promise<ScopedInverter> {
	if (!scope || scope.length === 0) {
		throw new ApiError(403, 'Unauthorized access to plant devices');
	}

	const plant = await dbClient.plant.findFirst({
		where: { id: BigInt(plantId), deletedAt: null },
		select: { id: true, userAccount: true },
	});

	if (!plant) {
		throw new ApiError(404, 'Plant not found');
	}

	if (!scope.includes(plant.userAccount)) {
		throw new ApiError(403, 'You do not have access to this plant');
	}

	const parsedDeviceId = parseDeviceId(deviceId);

	const inverter = await dbClient.deviceInverter.findFirst({
		where: { id: parsedDeviceId, plantId: BigInt(plantId), deletedAt: null },
		select: { id: true, serialNumber: true },
	});

	if (!inverter) {
		throw new ApiError(404, 'Device not found. Remote settings are only available for inverters.');
	}

	return inverter;
}

export { prisma };
