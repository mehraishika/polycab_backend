import type { Prisma } from '@/server/db/generated/prisma/client';
import { getScopedInverterOrThrow, prisma } from '../shared/inverter-scope';
import type { GridParametersSettings } from './grid-parameters.schema';

const TAB = 'gridParameters' as const;

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
	return value as Prisma.InputJsonValue;
}

// export async function getGridParametersSettings(
// 	scope: string[],
// 	plantId: string,
// 	deviceId: string,
// ): Promise<{
// 	settings: GridParametersSettings;
// 	rawSettings: Prisma.JsonValue | null;
// }> {
// 	const inverter = await getScopedInverterOrThrow(prisma, scope, plantId, deviceId);

// 	// const row = await prisma.deviceRemoteSetting.findUnique({
// 	// 	where: { deviceInverterId_tab: { deviceInverterId: INVERTER_SERIAL_NUMBER, tab: TAB } },
// 	// 	select: { settings: true },

// 	// });
// 	const row = await prisma.deviceRemoteSetting.findFirst({
// 		where: {
// 			deviceInverterId: INVERTER_SERIAL_NUMBER,
// 			tab: TAB,
// 		},
// 		orderBy: {
// 			createdAt: "desc",
// 		},
// 		select: {
// 			settings: true,
// 		},
// 	});
// 	// console.log("Inverter ID =", INVERTER_SERIAL_NUMBER);
// 	// console.log("GET ROW =", JSON.stringify(row, null, 2));
// 	// return (row?.settings as GridParametersSettings | undefined) ?? {};
// 	return {
// 		settings: (row?.settings as GridParametersSettings | undefined) ?? {},
// 		rawSettings: row?.settings ?? null,
// 	};
// }

// POST is a partial update: only fields present in `settings` are meant to
// change. The stored cache is merged (existing + submitted) so untouched
// fields survive; the task payload stays scoped to just what was submitted,
// since that's what actually needs writing to the device this time.

const INVERTER_SERIAL_NUMBER = BigInt(process.env.INVERTER_SERIAL_NUMBER!);
export async function createGridParametersReadTask(
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
export async function getGridParametersSettings(
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
}

export async function submitGridParametersSettings(
	scope: string[],
	plantId: string,
	deviceId: string,
	settings: GridParametersSettings,
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
