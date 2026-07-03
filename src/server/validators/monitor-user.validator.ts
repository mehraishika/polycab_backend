import { z } from "zod";

const numberStringSchema = z
  .string()
  .trim()
  .regex(/^\d+$/)
  .transform((value) => Number(value));

const idStringSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Id must be a positive integer")
  .refine((value) => {
    try {
      return BigInt(value) > BigInt(0);
    } catch {
      return false;
    }
  }, "Id must be a positive integer")
  .transform((value) => BigInt(value));

export const monitorUserIdParamSchema = z.object({
  monitorUserId: idStringSchema,
});

export const monitorUserListQuerySchema = z.object({
  page: z
    .union([z.number().int().positive(), numberStringSchema])
    .optional()
    .default(1),
  pageSize: z
    .union([z.number().int().positive().max(100), numberStringSchema])
    .optional()
    .default(10)
    .transform((value) => Math.min(value, 100)),
  status: z
    .enum(["all", "online", "abnormal", "standby", "offline"])
    .optional()
    .default("all"),
  sortBy: z.enum(["", "power", "today", "total"]).optional().default(""),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
  searchUser: z.string().trim().optional().default(""),
  searchSN: z.string().trim().optional().default(""),
  searchInstallationDate: z.string().trim().optional().default(""),
  searchAffiliation: z.string().trim().optional().default(""),
});

export const monitorUserStatusCountsQuerySchema = z.object({
  searchUser: z.string().trim().optional().default(""),
  searchSN: z.string().trim().optional().default(""),
  searchInstallationDate: z.string().trim().optional().default(""),
  searchAffiliation: z.string().trim().optional().default(""),
});

export const monitorUserLiveSummaryQuerySchema = z.object({
  monitorUserIds: z.string().trim().min(1, "monitorUserIds is required"),
});

export const monitorUserPlantsQuerySchema = z.object({
  page: z
    .union([z.number().int().positive(), numberStringSchema])
    .optional()
    .default(1),
  pageSize: z
    .union([z.number().int().positive().max(100), numberStringSchema])
    .optional()
    .default(10)
    .transform((value) => Math.min(value, 100)),
});

// const monitorUserIdsSchema = z
// 	.array(z.string().trim().regex(/^\d+$/, 'monitorUserId must be a positive integer'))
// 	.min(1, 'At least one monitor user id is required')
// 	.transform((ids) => ids.map((value) => BigInt(value)));

const monitorUserIdsSchema = z
  .array(z.string().trim().min(1, "Identifier cannot be empty"))
  .min(1, "At least one monitor user id or account name is required");
export const relateMonitorUsersBodySchema = z.object({
  monitorUserIds: monitorUserIdsSchema,
  relatedUserId: z
    .string()
    .trim()
    .regex(/^\d+$/, "relatedUserId must be a positive integer")
    .transform((value) => BigInt(value)),
});

// export const relateMonitorUsersBodySchema = z.object({
// 	monitorUserIds: monitorUserIdsSchema,
// 	relatedUserId: z
// 		.string()
// 		.trim()
// 		.regex(/^\d+$/, 'relatedUserId must be a positive integer')
// 		.transform((value) => BigInt(value)),
// });

export const relateUserBodySchema = z.object({
	account: z.string().trim().min(1, 'Account is required'),
	serialNumber: z.string().trim().min(1, 'Serial number is required'),
});


export const assignMonitorUsersBodySchema = z.object({
	monitorUserIds: monitorUserIdsSchema,
	assignedToUserId: z
		.string()
		.trim()
		.regex(/^\d+$/, "assignedToUserId must be a positive integer")
		.transform((value) => BigInt(value)),
});

const timezoneFormatSchema = z
  .string()
  .trim()
  .regex(
    /^UTC[+-](0\d|1\d|2[0-3]):[0-5]\d$/,
    "Timezone must be in UTC±HH:MM format",
  );

const phoneFormatSchema = z
  .string()
  .trim()
  .regex(/^\d{10,15}$/, "Phone must contain 10 to 15 digits");

export const createMonitorUserBodySchema = z
  .object({
    account: z.string().trim().min(1, "Account is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z
      .string()
      .min(8, "Confirm password must be at least 8 characters"),
    email: z.string().trim().email("Email must be valid"),
    phone: phoneFormatSchema,
    timezone: timezoneFormatSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password and confirm password must match",
    path: ["confirmPassword"],
  });

export type MonitorUserIdParamInput = z.infer<typeof monitorUserIdParamSchema>;
export type MonitorUserListQueryInput = z.infer<
  typeof monitorUserListQuerySchema
>;
export type MonitorUserStatusCountsQueryInput = z.infer<
  typeof monitorUserStatusCountsQuerySchema
>;
export type MonitorUserLiveSummaryQueryInput = z.infer<typeof monitorUserLiveSummaryQuerySchema>;
export type MonitorUserPlantsQueryInput = z.infer<typeof monitorUserPlantsQuerySchema>;
export type RelateUserBodyInput = z.infer<typeof relateUserBodySchema>;
export type AssignMonitorUsersBodyInput = z.infer<typeof assignMonitorUsersBodySchema>;
export type CreateMonitorUserBodyInput = z.infer<typeof createMonitorUserBodySchema>;
