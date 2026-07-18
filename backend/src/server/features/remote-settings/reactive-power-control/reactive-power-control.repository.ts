import type { Prisma } from '@/server/db/generated/prisma/client';
import { getScopedInverterOrThrow, prisma } from '../shared/inverter-scope';
import type { ReactivePowerControlSettings } from './reactive-power-control.schema';

const TAB = 'reactivePowerControl' as const;

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
	return value as Prisma.InputJsonValue;
}

export async function getReactivePowerControlSettings(
	scope: string[],
	plantId: string,
	deviceId: string,
): Promise<{
	settings: ReactivePowerControlSettings;
	rawSettings: Prisma.JsonValue | null;
}> {
	// ): Promise<ReactivePowerControlSettings> {
	const inverter = await getScopedInverterOrThrow(prisma, scope, plantId, deviceId);

	const row = await prisma.deviceRemoteSetting.findUnique({
		where: { deviceInverterId_tab: { deviceInverterId: 866192071837544, tab: TAB } },
		select: { settings: true },
	});

	return {
		settings: (row?.settings as ReactivePowerControlSettings | undefined) ?? {},
		rawSettings: row?.settings ?? null,
	};
	// return (row?.settings as ReactivePowerControlSettings | undefined) ?? {};
}

// POST is a partial update: only fields present in `settings` are meant to
// change. The stored cache is merged (existing + submitted) so untouched
// fields survive; the task payload stays scoped to just what was submitted,
// since that's what actually needs writing to the device this time.
export async function submitReactivePowerControlSettings(
	scope: string[],
	plantId: string,
	deviceId: string,
	settings: ReactivePowerControlSettings,
	updatedById: bigint,
): Promise<{ taskId: string }> {
	const inverter = await getScopedInverterOrThrow(prisma, scope, plantId, deviceId);

	const task = await prisma.$transaction(async (tx) => {
		const existing = await tx.deviceRemoteSetting.findUnique({
			where: { deviceInverterId_tab: { deviceInverterId: 866192071837544, tab: TAB } },
			select: { settings: true },
		});

		const merged = {
			...(existing?.settings as ReactivePowerControlSettings | undefined),
			...settings,
		};

		await tx.deviceRemoteSetting.upsert({
			where: { deviceInverterId_tab: { deviceInverterId: 866192071837544, tab: TAB } },
			create: { deviceInverterId: 866192071837544, tab: TAB, settings: toInputJson(merged), updatedById },
			update: { settings: toInputJson(merged), updatedById },
		});

		return tx.deviceRemoteSettingTask.create({
			data: {
				deviceInverterId: 866192071837544,
				kind: 'settings',
				tab: TAB,
				payload: toInputJson(settings),
				status: 'pending',
				createdById: updatedById,
			},
			select: { id: true },
		});
	});

	return { taskId: `task-${String(task.id)}` };
}
