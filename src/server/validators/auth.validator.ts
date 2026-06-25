import { z } from 'zod';

export const portalSchema = z.enum(['monitoring', 'service']);

export const loginSchema = z.object({
	portal: portalSchema,
	account: z.string().trim().min(1),
	password: z.string().min(1),
	remember: z.boolean().optional().default(false),
});

export const registerSchema = z
	.object({
		account: z.string().trim().min(1, 'Account is required'),
		password: z.string().min(8, 'Password must be at least 8 characters'),
		confirmPassword: z
			.string()
			.min(8, 'Confirm password must be at least 8 characters'),
		email: z.string().trim().email('Email must be valid'),
		timezone: z.string().trim().min(1, 'Timezone is required'),
		verificationCode: z
			.string()
			.trim()
			.min(1, 'Verification code is required'),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Password and confirm password must match',
		path: ['confirmPassword'],
	});

export const refreshSchema = z.object({
	refreshToken: z.string().trim().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
