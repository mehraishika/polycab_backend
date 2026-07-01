import { z } from "zod";

export const userIdParamSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^\d+$/, "User id must be a positive integer")
    .refine((value) => {
      try {
        return BigInt(value) > BigInt(0);
      } catch {
        return false;
      }
    }, "User id must be a positive integer")
    .transform((value) => BigInt(value)),
});

export const userRoleTypeParamSchema = z.object({
  role_type: z.enum([
    "all",
    "monitoring_user",
    "service_admin",
    "service_super_admin",
  ]),
});

const numberStringSchema = z
  .string()
  .trim()
  .regex(/^\d+$/)
  .transform((value) => Number(value));

export const userListQuerySchema = z.object({
  page: z
    .union([z.number().int().positive(), numberStringSchema])
    .optional()
    .default(1),
  limit: z
    .union([z.number().int().positive().max(100), numberStringSchema])
    .optional()
    .default(10)
    .transform((value) => Math.min(value, 100)),
  search: z.string().trim().min(1).optional(),
  portal: z.enum(["monitoring", "service"]).optional(),
  status: z.enum(["active", "disabled", "pending_verification"]).optional(),
  account: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(1).optional(),
  isDeleted: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) => {
      if (typeof value === "boolean") {
        return value;
      }

      if (value === "true") {
        return true;
      }

      if (value === "false") {
        return false;
      }

      return undefined;
    }),
});

export const createSubUserSchema = z
  .object({
    account: z.string().trim().min(1, "Account is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z
      .string()
      .min(8, "Confirm password must be at least 8 characters"),
    mobileNumber: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits"),
    email: z.string().trim().email("Email must be valid"),
    timezone: z.string().trim().min(1, "Timezone is required"),
    verificationCode: z.string().trim().optional(),
    role: z.enum(["service_admin", "service_super_admin"] as const, {
      error: "Role must be service_admin or service_super_admin",
    }),
    portal: z.literal("service"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password and confirm password must match",
    path: ["confirmPassword"],
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

export const serviceAdminUserListBodySchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(10),
  search: z.string().trim().default(""),
  sortBy: z
    .enum([
      "account",
      "email",
      "phone",
      "timezone",
      "status",
      "createdAt",
      "updatedAt",
    ])
    .default("account"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  includeDeleted: z.boolean().optional().default(false),
});

export const serviceAdminEditBodySchema = z
  .object({
    password: z.string().optional().default(""),
    phone: phoneFormatSchema,
    email: z.string().trim().email("Email must be valid"),
    timezone: timezoneFormatSchema,
  })
  .refine((data) => data.password === "" || data.password.length >= 8, {
    message: "Password must be at least 8 characters",
    path: ["password"],
  });

export const serviceAdminDeleteBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const ChangePasswordValidator = z
  .object({
    oldPassword: z.string().min(8),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const ForgotPasswordValidator = z
  .object({
    account: z.string().trim().min(1),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const UpdateProfileValidator = z.object({
  email: z.string().trim().email().optional(),
  phone: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  timezone: z.string().trim().nullable().optional(),
});

export const searchMonitoringUserSchema = z.object({
  account: z.string().trim().min(1, "Account is required"),
});

export type SearchMonitoringUserInput = z.infer<
  typeof searchMonitoringUserSchema
>;

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordValidator>;
export type CreateSubUserInput = z.infer<typeof createSubUserSchema>;
export type ServiceAdminUserListInput = z.infer<
  typeof serviceAdminUserListBodySchema
>;

export type ServiceAdminEditInput = z.infer<typeof serviceAdminEditBodySchema>;
export type ServiceAdminDeleteInput = z.infer<
  typeof serviceAdminDeleteBodySchema
>;

export const searchDeviceRequestSchema = z.object({
  sno: z.string().trim().min(1, "Serial Number is required"),
});

export type SearchDeviceRequest = z.infer<typeof searchDeviceRequestSchema>;
export type ChangePasswordValidator = z.infer<typeof ChangePasswordValidator>;

export type UserIdParamInput = z.infer<typeof userIdParamSchema>;
export type UserRoleTypeParamInput = z.infer<typeof userRoleTypeParamSchema>;
export type UserRoleType = UserRoleTypeParamInput["role_type"];
export type UserListQueryInput = z.infer<typeof userListQuerySchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileValidator>;
