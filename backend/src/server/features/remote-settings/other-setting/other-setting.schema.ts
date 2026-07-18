import { z } from 'zod';

export const otherSettingQuerySchema = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	plantId: z.string().min(1, 'plantId is required'),
});

export const otherSettingSettingsSchema = z.object({
	afdFunction: z.boolean().optional(),
	powerOn: z.boolean().optional(),
	gridVoltageType: z.enum(['Single Phase', 'Three Phase']).optional(),
});

export const otherSettingBodySchema = z.object({
	sn: z.string().optional(),
	settings: otherSettingSettingsSchema,
});

export type OtherSettingSettings = z.infer<typeof otherSettingSettingsSchema>;
export type OtherSettingQuery = z.infer<typeof otherSettingQuerySchema>;
