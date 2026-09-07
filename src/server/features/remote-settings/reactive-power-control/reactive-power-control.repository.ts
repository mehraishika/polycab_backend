import type { Prisma } from '@/server/db/generated/prisma/client';
import { getScopedInverterOrThrow, prisma } from '../shared/inverter-scope';
import type { ReactivePowerControlSettings } from './reactive-power-control.schema';

const TAB = 'reactivePowerControl' as const;

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
	return value as Prisma.InputJsonValue;
}

const INVERTER_SERIAL_NUMBER = BigInt(process.env.INVERTER_SERIAL_NUMBER!);
export async function createReactivePowerReadTask(
	scope: string[],
	sn: string,
	createdById: bigint,
): Promise<{
    taskId: bigint;
    macAddress: string;
}> {
	const inverter = await getScopedInverterOrThrow(
		prisma,
		scope,
		sn,
	);

	const task = await prisma.deviceRemoteSettingTask.create({
		data: {
			deviceInverterId: BigInt(inverter.macAddress),
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
		macAddress: inverter.macAddress,
	};
}
export async function getReactivePowerControlSettings(
	scope: string[],
	sn: string,
): Promise<{
	rawSettings: Prisma.JsonValue | null;
}> {
	// ): Promise<ReactivePowerControlSettings> {
	const inverter = await getScopedInverterOrThrow(prisma, scope, sn,);

	const row = await prisma.deviceRemoteSetting.findFirst({
		where: {
			deviceInverterId: BigInt(inverter.macAddress),
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
	// return (row?.settings as ReactivePowerControlSettings | undefined) ?? {};
}

// POST is a partial update: only fields present in `settings` are meant to
// change. The stored cache is merged (existing + submitted) so untouched
// fields survive; the task payload stays scoped to just what was submitted,
// since that's what actually needs writing to the device this time.
export async function submitReactivePowerControlSettings(
	scope: string[],
	sn: string,
	settings: ReactivePowerControlSettings,
	updatedById: bigint,
): Promise<{
    taskId: bigint;
    macAddress: string;
}> {
	const inverter = await getScopedInverterOrThrow(prisma, scope, sn,);

	const task = await prisma.deviceRemoteSettingTask.create({
		data: {
			deviceInverterId: BigInt(inverter.macAddress),
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
		macAddress: inverter.macAddress,
	};
}
