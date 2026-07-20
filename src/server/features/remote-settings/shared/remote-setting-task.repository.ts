import { prisma } from './inverter-scope';

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getTaskStatus(taskId: bigint) {
	return prisma.deviceRemoteSettingTask.findUnique({
		where: {
			id: taskId,
		},
		select: {
			status: true,
		},
	});
}

export async function waitForTask(
	taskId: bigint,
	timeoutMs = 180000,
	pollIntervalMs = 500,
) {
	const start = Date.now();

	while (Date.now() - start < timeoutMs) {
		const task = await getTaskStatus(taskId);

		if (!task) {
			throw new Error(`Remote setting task ${taskId} not found.`);
		}

		if (task.status === 'completed') {
			return {
				success: true,
				status: task.status,
			};
		}

		if (task.status === 'failed') {
			return {
				success: false,
				status: task.status,
			};
		}

		await delay(pollIntervalMs);
	}

	return {
		success: false,
		status: 'timeout',
	};
}