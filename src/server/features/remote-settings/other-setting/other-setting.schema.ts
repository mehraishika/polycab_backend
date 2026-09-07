import { z } from 'zod';

export const otherSettingQuerySchema = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	sn: z.string().min(1, 'sn is required'),
});

export const otherSettingSettingsSchema = z.object({
	afdFunction: z.number().optional(),
	powerOn: z.number().optional(),
	gridVoltageType: z.number().optional(),
	// gridVoltageType: z.enum(['Single Phase', 'Three Phase']).optional(),
});

export const otherSettingBodySchema = z.object({
	sn: z.string().min(1, 'sn is required'),
	settings: otherSettingSettingsSchema,
});

export type OtherSettingSettings = z.infer<typeof otherSettingSettingsSchema>;
export type OtherSettingQuery = z.infer<typeof otherSettingQuerySchema>;
