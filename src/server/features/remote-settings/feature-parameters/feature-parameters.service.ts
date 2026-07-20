import type { Prisma } from '@/server/db/generated/prisma/client';
import { publishRemoteSettingPattern } from '@/server/mqtt/publish-remote-setting';
import { UserRepository } from '@/server/repositories/user.repository';
import { ApiError } from '@/server/utils/api-error';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { getReadPattern, getRegisterMap, getWritePattern, pickRegisters } from '../shared/parameter-master';
import { getFeatureParametersSettings, submitFeatureParametersSettings, createfeatureParametersReadTask } from './feature-parameters.repository';
import type { FeatureParametersSettings } from './feature-parameters.schema';
import { waitForTask } from "../shared/remote-setting-task.repository";

const TAB = 'featureParameters';

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

export interface FeatureParametersReadParams {
	user: User;
	deviceId: string;
	plantId: string;
	fromService?: boolean;
	targetEndUserId?: string;
}

export interface FeatureParametersWriteParams extends FeatureParametersReadParams {
	settings: FeatureParametersSettings;
	sn?: string;
}

export type FeatureParametersReadResult = FeatureParametersSettings & {
	rawSettings: Prisma.JsonValue | null;
	registers: Record<string, string | null>;
	read_pattern: string;
	mqtt_published: boolean;
};

export interface SubmitFeatureParametersResult {
	taskId: string;
	registers: Record<string, string | null>;
	read_pattern: string;
	write_pattern: string;
	unmapped_fields: string[];
	request_data: FeatureParametersSettings;
	mqtt_published: boolean;
}

export async function getFeatureParameters(
	params: FeatureParametersReadParams,
): Promise<FeatureParametersReadResult> {
	const scope = await resolveScope(params.user, params.fromService, params.targetEndUserId);
	// const result = await getFeatureParametersSettings(scope, params.plantId, params.deviceId);
	// const settings = await getFeatureParametersSettings(scope, params.plantId, params.deviceId);
	const registers = await getRegisterMap(TAB);
	const read_pattern = await getReadPattern(TAB);
	const task = await createfeatureParametersReadTask(
		scope,
		params.plantId,
		params.deviceId,
		toBigIntUserId(params.user.userId),
	);
	const mqtt_published = await publishRemoteSettingPattern(read_pattern);

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

	const result = await getFeatureParametersSettings(
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
	// return { ...settings, registers, read_pattern, mqtt_published };
}

export async function submitFeatureParameters(
	params: FeatureParametersWriteParams,
): Promise<SubmitFeatureParametersResult> {
	const scope = await resolveScope(params.user, params.fromService, params.targetEndUserId);
	const task = await submitFeatureParametersSettings(
		scope,
		params.plantId,
		params.deviceId,
		params.settings,
		toBigIntUserId(params.user.userId),
	);

	const registerMap = await getRegisterMap(TAB);
	const registers = pickRegisters(registerMap, Object.keys(params.settings));
	const read_pattern = await getReadPattern(TAB);
	console.log("Feature settings:", params.settings);
	const { pattern: write_pattern, unmappedFields: unmapped_fields } = await getWritePattern(TAB, params.settings);
	const mqtt_published = await publishRemoteSettingPattern(write_pattern);
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
