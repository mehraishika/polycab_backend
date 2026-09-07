import { z } from 'zod';

export const featureParametersQuerySchema = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	sn: z.string().min(1, 'sn is required'),
});

export const featureParametersSettingsSchema = z.object({
	faultRideThroughFunction: z.number().optional(),
	islandDetection: z.number().optional(),
	terminalResistor: z.number().optional(),
	deratedPower: z.number().optional(),
	insulationImpedance: z.number().optional(),
	leakageCurrentPoint: z.number().optional(),
	movingAverageVoltageLimit: z.number().optional(),
});

export const featureParametersBodySchema = z.object({
	sn: z.string().min(1, 'sn is required'),
	settings: featureParametersSettingsSchema,
});

export type FeatureParametersSettings = z.infer<typeof featureParametersSettingsSchema>;
export type FeatureParametersQuery = z.infer<typeof featureParametersQuerySchema>;
