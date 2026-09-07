import { publishRemoteSettingPattern } from '@/server/mqtt/publish-remote-setting';
import { UserRepository } from '@/server/repositories/user.repository';
import { ApiError } from '@/server/utils/api-error';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { getCommandReadPattern, getCommandRegisterMap, getCommandWritePattern } from '../shared/command-master';
import { pickRegisters } from '../shared/parameter-master';
import { submitCommandAction } from './command.repository';
import type { CommandAction } from './command.schema';
import { waitForTask } from "../shared/remote-setting-task.repository";

async function resolveScope(user: User, fromService?: boolean, targetEndUserId?: string): Promise<string[]> {
	const baseScope = await resolveUserScope(user);
	const hasServiceRole = user.role === 'service_admin' || user.role === 'service_super_admin';

	if (fromService && hasServiceRole && targetEndUserId) {
		const userRepository = new UserRepository();
		const accountScope = await userRepository.getAccountScopeByUserId(targetEndUserId);

		if (!accountScope) {
			throw new ApiError(404, 'Selected end user not found');
		}

		return accountScope;
	}

	return baseScope;
}

function toBigIntUserId(userId: string): bigint {
	if (!/^\d+$/.test(userId)) {
		throw new ApiError(400, 'Invalid authenticated user id');
	}

	return BigInt(userId);
}

export interface SubmitCommandParams {
	user: User;
	command: CommandAction;
	sn: string;
	fromService?: boolean;
	targetEndUserId?: string;
}

export interface SubmitCommandResult {
	taskId: string;
	registers: Record<string, string | null>;
	read_pattern: string;
	write_pattern: string;
	unmapped_fields: string[];
	request_data: CommandAction;
	mqtt_published: boolean;
}

export async function submitCommand(params: SubmitCommandParams): Promise<SubmitCommandResult> {
	const scope = await resolveScope(params.user, params.fromService, params.targetEndUserId);
	const task = await submitCommandAction(
		scope,
		params.sn,
		params.command,
		toBigIntUserId(params.user.userId),
	);

	const registerMap = await getCommandRegisterMap();
	const registers = pickRegisters(registerMap, Object.keys(params.command));
	const read_pattern = await getCommandReadPattern();
	const { pattern: write_pattern, unmappedFields: unmapped_fields } = await getCommandWritePattern(params.command);
	const mqtt_published = await publishRemoteSettingPattern(task.macAddress, write_pattern);
	if (!mqtt_published) {
		throw new ApiError(500, "Failed to publish MQTT command.");
	}

	const writeResult = await waitForTask(task.taskId);

	if (!writeResult.success) {
		if (writeResult.status === "failed") {
			throw new ApiError(400, "Device rejected the write request.");
		}

		throw new ApiError(
			408,
			"Device did not respond.",
		);
	}

	return {
		taskId: task.taskId.toString(),
		registers,
		read_pattern,
		write_pattern,
		unmapped_fields,
		request_data: params.command,
		mqtt_published,
	};
}