import { z } from 'zod';

export const reactivePowerControlQuerySchema = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	plantId: z.string().min(1, 'plantId is required'),
});

export const reactivePowerControlSettingsSchema = z.object({
	settingTime: z.number().optional(),
	mode: z.number().optional(),
});

export const reactivePowerControlBodySchema = z.object({
	sn: z.string().optional(),
	settings: reactivePowerControlSettingsSchema,
});

export type ReactivePowerControlSettings = z.infer<typeof reactivePowerControlSettingsSchema>;
export type ReactivePowerControlQuery = z.infer<typeof reactivePowerControlQuerySchema>;
