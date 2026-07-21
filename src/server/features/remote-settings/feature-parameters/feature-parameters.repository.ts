import type { Prisma } from '@/server/db/generated/prisma/client';
import { getScopedInverterOrThrow, prisma } from '../shared/inverter-scope';
import type { FeatureParametersSettings } from './feature-parameters.schema';

const TAB = 'featureParameters' as const;

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
	return value as Prisma.InputJsonValue;
}

const INVERTER_SERIAL_NUMBER = BigInt(process.env.INVERTER_SERIAL_NUMBER!);
export async function createfeatureParametersReadTask(
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
export async function getFeatureParametersSettings(
	scope: string[],
	plantId: string,
	deviceId: string,
): Promise<{
	rawSettings: Prisma.JsonValue | null;
}> {
	// ): Promise<FeatureParametersSettings> {
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
	// return (row?.settings as FeatureParametersSettings | undefined) ?? {};
}

// POST is a partial update: only fields present in `settings` are meant to
// change. The stored cache is merged (existing + submitted) so untouched
// fields survive; the task payload stays scoped to just what was submitted,
// since that's what actually needs writing to the device this time.
export async function submitFeatureParametersSettings(
	scope: string[],
	plantId: string,
	deviceId: string,
	settings: FeatureParametersSettings,
	updatedById: bigint,
): Promise<{ taskId: bigint }> {
	const inverter = await getScopedInverterOrThrow(prisma, scope, plantId, deviceId);

	// const task = await prisma.$transaction(async (tx) => {
	// 	const existing = await tx.deviceRemoteSetting.findUnique({
	// 		where: { deviceInverterId_tab: { deviceInverterId: INVERTER_SERIAL_NUMBER, tab: TAB } },
	// 		select: { settings: true },
	// 	});

	// 	const merged = {
	// 		...(existing?.settings as FeatureParametersSettings | undefined),
	// 		...settings,
	// 	};

	// 	await tx.deviceRemoteSetting.upsert({
	// 		where: { deviceInverterId_tab: { deviceInverterId: INVERTER_SERIAL_NUMBER, tab: TAB } },
	// 		create: { deviceInverterId: INVERTER_SERIAL_NUMBER, tab: TAB, settings: toInputJson(merged), updatedById },
	// 		update: { settings: toInputJson(merged), updatedById },
	// 	});

	// 	return tx.deviceRemoteSettingTask.create({
	// 		data: {
	// 			deviceInverterId: INVERTER_SERIAL_NUMBER,
	// 			kind: 'settings',
	// 			tab: TAB,
	// 			payload: toInputJson(settings),
	// 			status: 'pending',
	// 			createdById: updatedById,
	// 		},
	// 		select: { id: true },
	// 	});
	// });

	// return { taskId: `task-${String(task.id)}` };

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
