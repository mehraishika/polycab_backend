import type { Prisma } from '@/server/db/generated/prisma/client';
import { getScopedInverterOrThrow, prisma } from '../shared/inverter-scope';
import type { CommandAction } from './command.schema';

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
	return value as Prisma.InputJsonValue;
}

export async function submitCommandAction(
	scope: string[],
	plantId: string,
	deviceId: string,
	command: CommandAction,
	createdById: bigint,
): Promise<{ taskId: string }> {
	const inverter = await getScopedInverterOrThrow(prisma, scope, plantId, deviceId);

	const task = await prisma.deviceRemoteSettingTask.create({
		data: {
			deviceInverterId: inverter.id,
			kind: 'command',
			tab: null,
			payload: toInputJson(command),
			status: 'pending',
			createdById,
		},
		select: { id: true },
	});

	return { taskId: `task-${String(task.id)}` };
}
