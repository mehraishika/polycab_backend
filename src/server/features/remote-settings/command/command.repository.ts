import type { Prisma } from '@/server/db/generated/prisma/client';
import { getScopedInverterOrThrow, prisma } from '../shared/inverter-scope';
import type { CommandAction } from './command.schema';

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
	return value as Prisma.InputJsonValue;
}

export async function createCommandsReadTask(
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
			deviceInverterId: inverter.id,
			kind: 'settings',
			tab: null,
			payload: {},
			status: 'pending',
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

export async function submitCommandAction(
	scope: string[],
	sn: string,
	command: CommandAction,
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
			deviceInverterId: inverter.id,
			kind: 'command',
			tab: null,
			payload: toInputJson(command),
			status: 'pending',
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