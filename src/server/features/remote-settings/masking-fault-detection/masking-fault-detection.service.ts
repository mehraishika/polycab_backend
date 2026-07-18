import type { Prisma } from '@/server/db/generated/prisma/client';
import { publishRemoteSettingPattern } from '@/server/mqtt/publish-remote-setting';
import { UserRepository } from '@/server/repositories/user.repository';
import { ApiError } from '@/server/utils/api-error';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { getReadPattern, getRegisterMap, getWritePattern, pickRegisters } from '../shared/parameter-master';
import {
	getMaskingFaultDetectionSettings,
	submitMaskingFaultDetectionSettings,
} from './masking-fault-detection.repository';
import type { MaskingFaultDetectionSettings } from './masking-fault-detection.schema';

const TAB = 'maskingFaultDetection';

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

export interface MaskingFaultDetectionReadParams {
	user: User;
	deviceId: string;
	plantId: string;
	fromService?: boolean;
	targetEndUserId?: string;
}

export interface MaskingFaultDetectionWriteParams extends MaskingFaultDetectionReadParams {
	settings: MaskingFaultDetectionSettings;
	sn?: string;
}

export type MaskingFaultDetectionReadResult = MaskingFaultDetectionSettings & {
	rawSettings: Prisma.JsonValue | null;
	registers: Record<string, string | null>;
	read_pattern: string;
	mqtt_published: boolean;
};

export interface SubmitMaskingFaultDetectionResult {
	taskId: string;
	registers: Record<string, string | null>;
	read_pattern: string;
	write_pattern: string;
	unmapped_fields: string[];
	request_data: MaskingFaultDetectionSettings;
	mqtt_published: boolean;
}

export async function getMaskingFaultDetection(
	params: MaskingFaultDetectionReadParams,
): Promise<MaskingFaultDetectionReadResult> {
	const scope = await resolveScope(params.user, params.fromService, params.targetEndUserId);
	const result = await getMaskingFaultDetectionSettings(scope, params.plantId, params.deviceId);
	// const settings = await getMaskingFaultDetectionSettings(scope, params.plantId, params.deviceId);
	const registers = await getRegisterMap(TAB);
	const read_pattern = await getReadPattern(TAB);
	const mqtt_published = await publishRemoteSettingPattern(read_pattern);

	return {
		...result.settings,
		rawSettings: result.rawSettings,
		registers,
		read_pattern,
		mqtt_published,
	};
	// return { ...settings, registers, read_pattern, mqtt_published };
}

export async function submitMaskingFaultDetection(
	params: MaskingFaultDetectionWriteParams,
): Promise<SubmitMaskingFaultDetectionResult> {
	const scope = await resolveScope(params.user, params.fromService, params.targetEndUserId);
	const result = await submitMaskingFaultDetectionSettings(
		scope,
		params.plantId,
		params.deviceId,
		params.settings,
		toBigIntUserId(params.user.userId),
	);

	const registerMap = await getRegisterMap(TAB);
	const registers = pickRegisters(registerMap, Object.keys(params.settings));
	const read_pattern = await getReadPattern(TAB);
	const { pattern: write_pattern, unmappedFields: unmapped_fields } = await getWritePattern(TAB, params.settings);
	const mqtt_published = await publishRemoteSettingPattern(write_pattern);
	return { ...result, registers, read_pattern, write_pattern, unmapped_fields, request_data: params.settings, mqtt_published };
}
