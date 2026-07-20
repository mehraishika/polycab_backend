import type { Prisma } from '@/server/db/generated/prisma/client';
import { publishRemoteSettingPattern } from '@/server/mqtt/publish-remote-setting';
import { UserRepository } from '@/server/repositories/user.repository';
import { ApiError } from '@/server/utils/api-error';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { getReadPattern, getRegisterMap, getWritePattern, pickRegisters } from '../shared/parameter-master';
import {
	getGridParametersSettings,
	submitGridParametersSettings,
	createGridParametersReadTask,
} from "./grid-parameters.repository";
import type { GridParametersSettings } from './grid-parameters.schema';
import { waitForTask } from "../shared/remote-setting-task.repository";

const TAB = 'gridParameters';

// Scope resolution and business rules for Grid Parameters live here, and
// only here — editing this file cannot affect any other tab.

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

export interface GridParametersReadParams {
	user: User;
	deviceId: string;
	plantId: string;
	fromService?: boolean;
	targetEndUserId?: string;
}

export interface GridParametersWriteParams extends GridParametersReadParams {
	settings: GridParametersSettings;
	sn?: string;
}

export type GridParametersReadResult = GridParametersSettings & {
	rawSettings: Prisma.JsonValue | null;
	registers: Record<string, string | null>;
	read_pattern: string;
	mqtt_published: boolean;
};

export interface SubmitGridParametersResult {
	taskId: string;
	registers: Record<string, string | null>;
	read_pattern: string;
	write_pattern: string;
	unmapped_fields: string[];
	request_data: GridParametersSettings;
	mqtt_published: boolean;
}

// registers surfaces each field's Modbus register address, read from
// remote_setting_parameter_master for this tab. read_pattern is the
// device read-request command string built from the same table's registerAddress/count.

// export async function getGridParameters(params: GridParametersReadParams): Promise<GridParametersReadResult> {
// 	const scope = await resolveScope(params.user, params.fromService, params.targetEndUserId);
// 	// const settings = await getGridParametersSettings(scope, params.plantId, params.deviceId);
// 	const result = await getGridParametersSettings(scope, params.plantId, params.deviceId);
// 	// console.log(result);
// 	const registers = await getRegisterMap(TAB);
// 	const read_pattern = await getReadPattern(TAB);
// 	const mqtt_published = await publishRemoteSettingPattern(read_pattern);

// 	// return { ...settings, registers, read_pattern, mqtt_published };
// 	return {
// 		rawSettings: result.rawSettings,
// 		registers,
// 		read_pattern,
// 		mqtt_published,
// 	};
// }

export async function getGridParameters(
	params: GridParametersReadParams,
): Promise<GridParametersReadResult> {
	const scope = await resolveScope(
		params.user,
		params.fromService,
		params.targetEndUserId,
	);

	const registers = await getRegisterMap(TAB);
	const read_pattern = await getReadPattern(TAB);

	const task = await createGridParametersReadTask(
		scope,
		params.plantId,
		params.deviceId,
		toBigIntUserId(params.user.userId),
	);

	const mqtt_published =
		await publishRemoteSettingPattern(read_pattern);

	if (!mqtt_published) {
		throw new ApiError(
			500,
			"Failed to publish MQTT read command."
		);
	}

	const readResult = await waitForTask(task.taskId);

	if (!readResult.success) {
		if (readResult.status === "failed") {
			throw new ApiError(
				400,
				"Device rejected the read request."
			);
		}

		throw new ApiError(
			408,
			"Device did not respond within 2 minutes."
		);
	}

	const result = await getGridParametersSettings(
		scope,
		params.plantId,
		params.deviceId,
	);

	return {
		rawSettings: result.rawSettings,
		registers,
		read_pattern,
		mqtt_published,
	};
}

// export async function submitGridParameters(params: GridParametersWriteParams): Promise<SubmitGridParametersResult> {
// 	const scope = await resolveScope(params.user, params.fromService, params.targetEndUserId);
// 	const result = await submitGridParametersSettings(
// 		scope,
// 		params.plantId,
// 		params.deviceId,
// 		params.settings,
// 		toBigIntUserId(params.user.userId),
// 	);

// 	const registerMap = await getRegisterMap(TAB);
// 	const registers = pickRegisters(registerMap, Object.keys(params.settings));
// 	const read_pattern = await getReadPattern(TAB);
// 	const { pattern: write_pattern, unmappedFields: unmapped_fields } = await getWritePattern(TAB, params.settings);
// 	const mqtt_published = await publishRemoteSettingPattern(write_pattern);
// 	return { ...result, registers, read_pattern, write_pattern, unmapped_fields, request_data: params.settings, mqtt_published };
// }
export async function submitGridParameters(
	params: GridParametersWriteParams,
): Promise<SubmitGridParametersResult> {
	const scope = await resolveScope(
		params.user,
		params.fromService,
		params.targetEndUserId,
	);

	const task = await submitGridParametersSettings(
		scope,
		params.plantId,
		params.deviceId,
		params.settings,
		toBigIntUserId(params.user.userId),
	);

	const registerMap = await getRegisterMap(TAB);

	const registers = pickRegisters(
		registerMap,
		Object.keys(params.settings),
	);

	const read_pattern = await getReadPattern(TAB);

	const {
		pattern: write_pattern,
		unmappedFields: unmapped_fields,
	} = await getWritePattern(TAB, params.settings);

	const mqtt_published =
		await publishRemoteSettingPattern(write_pattern);

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
		request_data: params.settings,
		mqtt_published,
	};
}