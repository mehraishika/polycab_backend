import { z } from 'zod';

export const maskingFaultDetectionQuerySchema = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	plantId: z.string().min(1, 'plantId is required'),
});

export const maskingFaultDetectionSettingsSchema = z.object({
	a3: z.boolean().optional(),
	a4: z.boolean().optional(),
	b1: z.boolean().optional(),
	b2: z.boolean().optional(),
	cl: z.boolean().optional(),
	b4: z.boolean().optional(),
	c2: z.boolean().optional(),
	c3: z.boolean().optional(),
	cn: z.boolean().optional(),
	ce: z.boolean().optional(),
	bb: z.boolean().optional(),
	a8: z.boolean().optional(),
});

export const maskingFaultDetectionBodySchema = z.object({
	sn: z.string().optional(),
	settings: maskingFaultDetectionSettingsSchema,
});

export type MaskingFaultDetectionSettings = z.infer<typeof maskingFaultDetectionSettingsSchema>;
export type MaskingFaultDetectionQuery = z.infer<typeof maskingFaultDetectionQuerySchema>;
