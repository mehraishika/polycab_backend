import { z } from 'zod';

export const powerLimitQuerySchema = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	plantId: z.string().min(1, 'plantId is required'),
});

export const powerLimitSettingsSchema = z.object({
	powerControl: z.enum(['Disable', 'Enable']).optional(),
	meterLocation: z.enum(['Grid side', 'Load side']).optional(),
	powerFlowDirection: z.enum(['Export', 'Import']).optional(),
	maxFeedInGridPower: z.number().optional(),
	modbusAddress: z.number().optional(),
});

export const powerLimitBodySchema = z.object({
	sn: z.string().optional(),
	settings: powerLimitSettingsSchema,
});

export type PowerLimitSettings = z.infer<typeof powerLimitSettingsSchema>;
export type PowerLimitQuery = z.infer<typeof powerLimitQuerySchema>;
