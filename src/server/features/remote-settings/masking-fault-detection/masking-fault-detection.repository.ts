import type { Prisma } from '@/server/db/generated/prisma/client';
import { getScopedInverterOrThrow, prisma } from '../shared/inverter-scope';
import type { MaskingFaultDetectionSettings } from './masking-fault-detection.schema';

const TAB = 'maskingFaultDetection' as const;

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
	return value as Prisma.InputJsonValue;
}
const INVERTER_SERIAL_NUMBER = BigInt(process.env.INVERTER_SERIAL_NUMBER!);

export async function createMaskingFaultDetectionReadTask(
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
export async function getMaskingFaultDetectionSettings(
	scope: string[],
	plantId: string,
	deviceId: string,
): Promise<{
	rawSettings: Prisma.JsonValue | null;
}> {
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
	// return (row?.settings as MaskingFaultDetectionSettings | undefined) ?? {};
}

// POST is a partial update: only fields present in `settings` are meant to
// change. The stored cache is merged (existing + submitted) so untouched
// fields survive; the task payload stays scoped to just what was submitted,
// since that's what actually needs writing to the device this time.
export async function submitMaskingFaultDetectionSettings(
	scope: string[],
	plantId: string,
	deviceId: string,
	settings: MaskingFaultDetectionSettings,
	updatedById: bigint,
): Promise<{ taskId: bigint }> {
	const inverter = await getScopedInverterOrThrow(prisma, scope, plantId, deviceId);

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
