import { z } from 'zod';

export const gridParametersQuerySchema = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	plantId: z.string().min(1, 'plantId is required'),
});

export const gridParametersSettingsSchema = z.object({
	standardCode: z.enum(['IN', 'EU', 'AU']).optional(),
	firstConnectDelayTime: z.number().optional(),
	reconnectDelayTime: z.number().optional(),
	firstConnectPowerGradient: z.number().optional(),
	reconnectPowerGradient: z.number().optional(),
	gridFirstConnectionVoltageHighLimit: z.number().optional(),
	gridFirstConnectionVoltageLowLimit: z.number().optional(),
	gridFirstConnectionFrequencyHighLimit: z.number().optional(),
	gridFirstConnectionFrequencyLowLimit: z.number().optional(),
	gridReconnectionVoltageHighLimit: z.number().optional(),
	gridReconnectionVoltageLowLimit: z.number().optional(),
	gridReconnectionFrequencyHighLimit: z.number().optional(),
	gridReconnectionFrequencyLowLimit: z.number().optional(),
	frequencyHighLossLevel1: z.number().optional(),
	frequencyLowLossLevel1: z.number().optional(),
	voltageHighLossLevel1: z.number().optional(),
	voltageLowLossLevel1: z.number().optional(),
	frequencyHighLossTimeLevel1: z.number().optional(),
	frequencyLowLossTimeLevel1: z.number().optional(),
	voltageHighLossTimeLevel1: z.number().optional(),
	voltageLowLossTimeLevel1: z.number().optional(),
	voltageHighLossLevel2: z.number().optional(),
	voltageLowLossLevel2: z.number().optional(),
	voltageHighLossTimeLevel2: z.number().optional(),
	voltageLowLossTimeLevel2: z.number().optional(),
	overFrequencyDeratingFunction: z.boolean().optional(),
	underFrequencyFunction: z.boolean().optional(),
	overVoltageDerating: z.boolean().optional(),
});

export const gridParametersBodySchema = z.object({
	sn: z.string().optional(),
	settings: gridParametersSettingsSchema,
});

export type GridParametersSettings = z.infer<typeof gridParametersSettingsSchema>;
export type GridParametersQuery = z.infer<typeof gridParametersQuerySchema>;
