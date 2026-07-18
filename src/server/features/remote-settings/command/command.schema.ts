import { z } from 'zod';

export const commandQuerySchema = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	plantId: z.string().min(1, 'plantId is required'),
});

export const commandActionSchema = z.object({
	afdReset: z.boolean().optional(),
	syncDateTime: z.boolean().optional(),
	reset: z.boolean().optional(),
	clearAllData: z.boolean().optional(),
});

export const commandBodySchema = z.object({
	sn: z.string().optional(),
	command: commandActionSchema,
});

export type CommandAction = z.infer<typeof commandActionSchema>;
export type CommandQuery = z.infer<typeof commandQuerySchema>;
