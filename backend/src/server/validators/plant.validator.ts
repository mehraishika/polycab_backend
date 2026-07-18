import { z } from 'zod';

/**
 * Plant List Validator
 * Validates request body for plant list endpoint
 */
export const PlantListValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  selectedEndUserId: z.string().optional(),
  monitorUserId: z.string().optional(),
  status: z.enum(['All', 'Normal', 'Abnormal', 'Standby', 'Offline']).default('All'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  search: z.string().optional().default(''),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Plant Summary Validator
 * Validates request body for plant summary endpoint
 */
export const PlantSummaryValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  selectedEndUserId: z.string().optional(),
  monitorUserId: z.string().optional(),
  search: z.string().optional().default(''),
});

/**
 * Plant Live Rows Validator
 * Validates request body for live rows endpoint
 */
export const PlantLiveRowsValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  selectedEndUserId: z.string().optional(),
  monitorUserId: z.string().optional(),
  status: z.enum(['All', 'Normal', 'Abnormal', 'Standby', 'Offline']).default('All'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  plantIds: z.array(z.union([z.string(), z.number()])),
});

/**
 * Plant View Validator
 * Validates request body for plant view endpoint
 */
export const PlantViewValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
});

/**
 * Plant Create Validator
 * Validates request body for plant create endpoint
 */
export const PlantCreateValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  selectedEndUserId: z.string().optional(),
  monitorUserId: z.string().optional(),
  plantName: z.string().min(1, 'Plant name is required'),
  plantType: z.string().min(1, 'Plant type is required'),
  installedDate: z.string().min(1, 'Installed Date is required'),
  kwp: z.number().min(1, 'Plant capacity is required'),
  price: z.number().min(1, 'Plant Price is required'),
  priceUnit: z.string(),
  longitude: z.string().min(1, 'longitude is required'),
  latitude: z.string().min(1, 'latitude is required'),
  address: z.string().min(1, 'Address is required'),
  pictureFileId: z.string().optional(),
});

/**
 * Plant Edit Validator
 * Validates request body for plant edit endpoint
 */
export const PlantEditValidator = z.object({
  role: z.string().optional(),
  plantName: z.string().min(1, 'Plant name is required'),
  plantType: z.string().min(1, 'Plant type is required'),
  installedDate: z.string().min(1, 'Installed Date is required'),
  kwp: z.number().min(1, 'Plant capacity is required'),
  price: z.number().min(1, 'Plant Price is required'),
  priceUnit: z.string(),
  longitude: z.string().min(1, 'longitude is required'),
  latitude: z.string().min(1, 'latitude is required'),
  address: z.string().min(1, 'Address is required'),
  pictureFileId: z.string().optional(),
});

/**
 * Plant Delete Validator
 * Validates request body for plant delete endpoint
 */
export const PlantDeleteValidator = z.object({
  role: z.string().optional(),
  reason: z.string().optional(),
});

/**
 * Plant Overview Query Validator
 * Validates query params for plant overview endpoint
 */
export const PlantOverviewQueryValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  targetEndUserId: z.string().optional(),
});

/**
 * Plant Overview Live Query Validator
 * Validates query params for plant overview live endpoint
 */
export const PlantOverviewLiveQueryValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  targetEndUserId: z.string().optional(),
  since: z.string().optional(),
});

/**
 * Plant Analysis Devices Query Validator
 */
export const PlantAnalysisDevicesQueryValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  targetEndUserId: z.string().optional(),
});

/**
 * Plant Analysis Parameters Query Validator
 */
export const PlantAnalysisParametersQueryValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  targetEndUserId: z.string().optional(),
  deviceId: z.string().min(1, 'deviceId is required'),
});

/**
 * Plant Analysis Data Query Validator
 */
export const PlantAnalysisQueryValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  targetEndUserId: z.string().optional(),
  deviceId: z.string().min(1, 'deviceId is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  parameters: z.string().min(1, 'parameters are required'),
  interval: z.enum(['5m', '15m', '30m', '60m']).default('15m'),
});

/**
 * Plant Chart Query Validator
 */
export const PlantChartQueryValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  targetEndUserId: z.string().optional(),
  date: z.string().min(1, 'date is required'),
  range: z.enum(['day', 'month', 'year']),
  mode: z.enum(['total', 'single']).default('total'),
});

/**
 * Plant Chart Export Query Validator
 */
export const PlantChartExportQueryValidator = PlantChartQueryValidator.extend({
  format: z.enum(['csv']).default('csv'),
});

/**
 * Plant Current Alerts Query Validator
 */
export const PlantCurrentAlertsQueryValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  targetEndUserId: z.string().optional(),
  status: z.enum(['active']).default('active'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  since: z.string().optional(),
});

/**
 * Plant Information Query Validator
 */
export const PlantInformationQueryValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  targetEndUserId: z.string().optional(),
});

/**
 * Plant Information Live Query Validator
 */
export const PlantInformationLiveQueryValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  targetEndUserId: z.string().optional(),
  since: z.string().optional(),
});

/**
 * Plant Device Overview Query Validator
 */
export const PlantDeviceOverviewQueryValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  targetEndUserId: z.string().optional(),
});

/**
 * Plant Device Overview Live Query Validator
 */
export const PlantDeviceOverviewLiveQueryValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  targetEndUserId: z.string().optional(),
  since: z.string().optional(),
});

/**
 * Plant Add Logger Body Validator
 */
export const PlantAddLoggerBodyValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  targetEndUserId: z.string().optional(),
  serialNumber: z.string().trim().min(1, 'serialNumber is required'),
});

// Export TypeScript types
export type PlantListInput = z.infer<typeof PlantListValidator>;
export type PlantSummaryInput = z.infer<typeof PlantSummaryValidator>;
export type PlantLiveRowsInput = z.infer<typeof PlantLiveRowsValidator>;
export type PlantViewInput = z.infer<typeof PlantViewValidator>;
export type PlantCreateInput = z.infer<typeof PlantCreateValidator>;
export type PlantEditInput = z.infer<typeof PlantEditValidator>;
export type PlantDeleteInput = z.infer<typeof PlantDeleteValidator>;
export type PlantOverviewQueryInput = z.infer<typeof PlantOverviewQueryValidator>;
export type PlantOverviewLiveQueryInput = z.infer<typeof PlantOverviewLiveQueryValidator>;
export type PlantAnalysisDevicesQueryInput = z.infer<typeof PlantAnalysisDevicesQueryValidator>;
export type PlantAnalysisParametersQueryInput = z.infer<typeof PlantAnalysisParametersQueryValidator>;
export type PlantAnalysisQueryInput = z.infer<typeof PlantAnalysisQueryValidator>;
export type PlantChartQueryInput = z.infer<typeof PlantChartQueryValidator>;
export type PlantChartExportQueryInput = z.infer<typeof PlantChartExportQueryValidator>;
export type PlantCurrentAlertsQueryInput = z.infer<typeof PlantCurrentAlertsQueryValidator>;
export type PlantInformationQueryInput = z.infer<typeof PlantInformationQueryValidator>;
export type PlantInformationLiveQueryInput = z.infer<typeof PlantInformationLiveQueryValidator>;
export type PlantDeviceOverviewQueryInput = z.infer<typeof PlantDeviceOverviewQueryValidator>;
export type PlantDeviceOverviewLiveQueryInput = z.infer<typeof PlantDeviceOverviewLiveQueryValidator>;
export type PlantAddLoggerBodyInput = z.infer<typeof PlantAddLoggerBodyValidator>;

/**
 * Plant Logs Query Validator
 * Validates query params for logs listing endpoint
 */
export const PlantLogsQueryValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  targetEndUserId: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  search: z.string().default(''),
  event: z.string().default('All'),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateFrom must be YYYY-MM-DD'),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateTo must be YYYY-MM-DD'),
});

/**
 * Plant Logs Export Query Validator
 * Validates query params for logs export endpoint
 */
export const PlantLogsExportQueryValidator = z.object({
  role: z.string().optional(),
  fromService: z.boolean().optional(),
  targetEndUserId: z.string().optional(),
  search: z.string().default(''),
  event: z.string().default('All'),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateFrom must be YYYY-MM-DD'),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateTo must be YYYY-MM-DD'),
  format: z.enum(['csv']).default('csv'),
});

export const LogsQueryValidator = z.object({
	page: z.number().min(1).default(1),
	pageSize: z.number().min(1).max(100).default(10),
	search: z.string().default(''),
	event: z.string().default('All'),
	dateFrom: z.string().optional(),
	dateTo: z.string().optional(),
	fromService: z.boolean().optional(),
	targetEndUserId: z.string().optional(),
});

export type PlantLogsQueryInput = z.infer<typeof PlantLogsQueryValidator>;
export type PlantLogsExportQueryInput = z.infer<typeof PlantLogsExportQueryValidator>;
