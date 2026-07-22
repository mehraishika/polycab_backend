import { z } from 'zod';

export const maskingFaultDetectionQuerySchema = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	plantId: z.string().min(1, 'plantId is required'),
});

export const maskingFaultDetectionSettingsSchema = z.object({
	a3: z.number().optional(),
	a4: z.number().optional(),
	b1: z.number().optional(),
	b2: z.number().optional(),
	cl: z.number().optional(),
	b4: z.number().optional(),
	c2: z.number().optional(),
	c3: z.number().optional(),
	cn: z.number().optional(),
	ce: z.number().optional(),
	bb: z.number().optional(),
	a8: z.number().optional(),
});

export const maskingFaultDetectionBodySchema = z.object({
	sn: z.string().optional(),
	settings: maskingFaultDetectionSettingsSchema,
});

export type MaskingFaultDetectionSettings = z.infer<typeof maskingFaultDetectionSettingsSchema>;
export type MaskingFaultDetectionQuery = z.infer<typeof maskingFaultDetectionQuerySchema>;
