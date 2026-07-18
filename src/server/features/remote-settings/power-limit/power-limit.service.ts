import type { Prisma } from '@/server/db/generated/prisma/client';
import { publishRemoteSettingPattern } from '@/server/mqtt/publish-remote-setting';
import { UserRepository } from '@/server/repositories/user.repository';
import { ApiError } from '@/server/utils/api-error';
import type { User } from '@/server/utils/auth-helper';
import { resolveUserScope } from '@/server/utils/scope-resolver';
import { getReadPattern, getRegisterMap, getWritePattern, pickRegisters } from '../shared/parameter-master';
import { getPowerLimitSettings, submitPowerLimitSettings } from './power-limit.repository';
import type { PowerLimitSettings } from './power-limit.schema';

const TAB = 'powerLimit';

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

export interface PowerLimitReadParams {
	user: User;
	deviceId: string;
	plantId: string;
	fromService?: boolean;
	targetEndUserId?: string;
}

export interface PowerLimitWriteParams extends PowerLimitReadParams {
	settings: PowerLimitSettings;
	sn?: string;
}

export type PowerLimitReadResult = PowerLimitSettings & {
	rawSettings: Prisma.JsonValue | null;
	registers: Record<string, string | null>;
	read_pattern: string;
	mqtt_published: boolean;
};

export interface SubmitPowerLimitResult {
	taskId: string;
	registers: Record<string, string | null>;
	read_pattern: string;
	write_pattern: string;
	unmapped_fields: string[];
	request_data: PowerLimitSettings;
	mqtt_published: boolean;
}

export async function getPowerLimit(params: PowerLimitReadParams): Promise<PowerLimitReadResult> {
	const scope = await resolveScope(params.user, params.fromService, params.targetEndUserId);
	// const settings = await getPowerLimitSettings(scope, params.plantId, params.deviceId);
	const result = await getPowerLimitSettings(scope, params.plantId, params.deviceId);
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

export async function submitPowerLimit(params: PowerLimitWriteParams): Promise<SubmitPowerLimitResult> {
	const scope = await resolveScope(params.user, params.fromService, params.targetEndUserId);
	const result = await submitPowerLimitSettings(
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
