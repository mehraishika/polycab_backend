import { z } from 'zod';

export const DeviceListQueryValidator = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(10),
	sortBy: z.enum(['name', 'type', 'sn', 'power', 'today', 'total', 'hours']).default('name'),
	sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const DeviceLiveRowsQueryValidator = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	deviceIds: z.string().min(1, 'deviceIds is required'),
});

export const DeviceAddBodyValidator = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	serialNumber: z.string().min(1, 'serialNumber is required')
	// type: z.string().min(1, 'type is required'),
});

export const DeviceViewQueryValidator = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	plantId: z.string().min(1, 'plantId is required'),
	targetEndUserId: z.string().optional(),
});

export const DeviceEditBodyValidator = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	plantId: z.string().min(1, 'plantId is required'),
	name: z.string().min(1, 'name is required'),
});

export const DeviceDeleteBodyValidator = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	plantId: z.string().min(1, 'plantId is required'),
	reason: z.string().optional(),
});

export const DeviceChartQueryValidator = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	plantId: z.string().min(1, 'plantId is required'),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
	range: z.enum(['day', 'month', 'year']),
});

export const DeviceChartExportQueryValidator = DeviceChartQueryValidator.extend({
	format: z.enum(['csv']).default('csv'),
});

export const DeviceCurrentAlertsQueryValidator = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	plantId: z.string().min(1, 'plantId is required'),
	status: z.enum(['active']).default('active'),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(10),
	since: z.string().datetime().optional(),
	sortBy: z.enum(['name', 'sn', 'event', 'severity', 'startedAt', 'lastUpdatedAt']).default('lastUpdatedAt'),
	sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const DeviceInformationQueryValidator = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	plantId: z.string().min(1, 'plantId is required'),
	dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateFrom must be YYYY-MM-DD').optional(),
	dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateTo must be YYYY-MM-DD').optional(),
});

export const DeviceInformationLiveQueryValidator = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	plantId: z.string().min(1, 'plantId is required'),
	since: z.string().datetime().optional(),
});

export const DeviceInformationExportQueryValidator = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	plantId: z.string().min(1, 'plantId is required'),
	dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateFrom must be YYYY-MM-DD'),
	dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateTo must be YYYY-MM-DD'),
	format: z.enum(['csv']).default('csv'),
});

export const DeviceLogsQueryValidator = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	plantId: z.string().min(1, 'plantId is required'),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(10),
	search: z.string().default(''),
	event: z.string().default('All'),
	dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateFrom must be YYYY-MM-DD'),
	dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateTo must be YYYY-MM-DD'),
	sortBy: z.enum(['name', 'type', 'sn', 'time', 'status', 'event']).default('time'),
	sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const DeviceLogsExportQueryValidator = z.object({
	role: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
	plantId: z.string().min(1, 'plantId is required'),
	search: z.string().default(''),
	event: z.string().default('All'),
	dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateFrom must be YYYY-MM-DD'),
	dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateTo must be YYYY-MM-DD'),
	sortBy: z.enum(['name', 'type', 'sn', 'time', 'status', 'event']).default('time'),
	sortOrder: z.enum(['asc', 'desc']).default('desc'),
	format: z.enum(['csv']).default('csv'),
});

export type DeviceListQueryInput = z.infer<typeof DeviceListQueryValidator>;
export type DeviceLiveRowsQueryInput = z.infer<typeof DeviceLiveRowsQueryValidator>;
export type DeviceAddBodyInput = z.infer<typeof DeviceAddBodyValidator>;
export type DeviceViewQueryInput = z.infer<typeof DeviceViewQueryValidator>;
export type DeviceEditBodyInput = z.infer<typeof DeviceEditBodyValidator>;
export type DeviceDeleteBodyInput = z.infer<typeof DeviceDeleteBodyValidator>;
export type DeviceChartQueryInput = z.infer<typeof DeviceChartQueryValidator>;
export type DeviceChartExportQueryInput = z.infer<typeof DeviceChartExportQueryValidator>;
export type DeviceCurrentAlertsQueryInput = z.infer<typeof DeviceCurrentAlertsQueryValidator>;
export type DeviceInformationQueryInput = z.infer<typeof DeviceInformationQueryValidator>;
export type DeviceInformationLiveQueryInput = z.infer<typeof DeviceInformationLiveQueryValidator>;
export type DeviceInformationExportQueryInput = z.infer<typeof DeviceInformationExportQueryValidator>;
export type DeviceLogsQueryInput = z.infer<typeof DeviceLogsQueryValidator>;
export type DeviceLogsExportQueryInput = z.infer<typeof DeviceLogsExportQueryValidator>;
