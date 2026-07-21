import type { Prisma } from '@/server/db/generated/prisma/client';
import { getScopedInverterOrThrow, prisma } from '../shared/inverter-scope';
import type { PowerLimitSettings } from './power-limit.schema';

const TAB = 'powerLimit' as const;

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
	return value as Prisma.InputJsonValue;
}

const INVERTER_SERIAL_NUMBER = BigInt(process.env.INVERTER_SERIAL_NUMBER!);

export async function createPowerLimitReadTask(
	scope: string[],
	plantId: string,
	deviceId: string,
	createdById: bigint,
): Promise<{ taskId: bigint }> {
	await getScopedInverterOrThrow(
		prisma,
		scope,
		plantId,
		deviceId,
	);

	const task = await prisma.deviceRemoteSettingTask.create({
		data: {
			deviceInverterId: INVERTER_SERIAL_NUMBER,
			kind: "settings",
			tab: TAB,
			payload: {},
			status: "pending",
			createdById,
		},
		select: {
			id: true,
		},
	});

	return {
		taskId: task.id,
	};
}

export async function getPowerLimitSettings(
	scope: string[],
	plantId: string,
	deviceId: string,
): Promise<{
	rawSettings: Prisma.JsonValue | null;
}> {
	// ): Promise<PowerLimitSettings> {
	await getScopedInverterOrThrow(prisma, scope, plantId, deviceId);

	const row = await prisma.deviceRemoteSetting.findFirst({
		where: {
			deviceInverterId: INVERTER_SERIAL_NUMBER,
			tab: TAB,
		},
		orderBy: {
			createdAt: "desc",
		},
		select: {
			settings: true,
		},
	});

	return {
		rawSettings: row?.settings ?? [],
	};
	// return (row?.settings as PowerLimitSettings | undefined) ?? {};
}

// POST is a partial update: only fields present in `settings` are meant to
// change. The stored cache is merged (existing + submitted) so untouched
// fields survive; the task payload stays scoped to just what was submitted,
// since that's what actually needs writing to the device this time.
export async function submitPowerLimitSettings(
	scope: string[],
	plantId: string,
	deviceId: string,
	settings: PowerLimitSettings,
	updatedById: bigint,
): Promise<{ taskId: bigint }> {
	const inverter = await getScopedInverterOrThrow(
		prisma,
		scope,
		plantId,
		deviceId,
	);

	const task = await prisma.deviceRemoteSettingTask.create({
		data: {
			deviceInverterId: INVERTER_SERIAL_NUMBER,
			kind: "settings",
			tab: TAB,
			payload: toInputJson(settings),
			status: "pending",
			createdById: updatedById,
		},
		select: {
			id: true,
		},
	});

	return {
		taskId: task.id,
	};
}
