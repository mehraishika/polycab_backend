import type { NextRequest } from "next/server";

import { prisma } from "@/server/db/prisma";

import {
	errorResponse,
	successResponse,
} from "@/server/utils/api-response";

import { ApiError } from "@/server/utils/api-error";

import { withRequestLogging }
	from "@/server/middleware/request-log.middleware";

import { z } from "zod";

const FotaUpdateValidator = z.object({
	mac_address: z.string().min(1),
	firmware: z.string().regex(/^\d{4}$/, {
		message: "Firmware must be 4 digits",
	}),
	fw_url: z.string().optional(),
});

async function getFotaRoute(
	request: NextRequest
): Promise<Response> {
	try {
		const macAddress =
			request.nextUrl.searchParams
			.get("mac_address")
			?.trim();

		if (!macAddress) {
			return errorResponse(
				"No mac_address found in query",
				400
			);
		}

		const existingFota =
			await prisma.fota.findUnique({
				where: {
					mac_address: macAddress,
				},
			});

		if (!existingFota) {
			const firmware = "0001";

			const fw_url =
				"http://hbiot.in/OTA/BinFiles/4";

			await prisma.fota.create({
				data: {
					mac_address: macAddress,
					firmware,
					link: fw_url,
				},
			});

			return successResponse(
				"mac_address inserted in fota table",
				{
					mac_address: macAddress,
				},
				201
			);
		}

		return successResponse(
			"Firmware fetched successfully",
			{
				mac_address:
					existingFota.mac_address,

				firmware:
					existingFota.firmware,

				fw_url:
					existingFota.link,
			},
			200
		);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(
				error.message,
				error.statusCode
			);
		}

		return errorResponse(
			"Failed to fetch firmware",
			500
		);
	}
}

async function updateFotaRoute(
	request: NextRequest
): Promise<Response> {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return errorResponse(
			"Invalid JSON payload",
			400
		);
	}

	const parsed =
		FotaUpdateValidator.safeParse(body);

	if (!parsed.success) {
		const issue =
			parsed.error.issues[0];

		return errorResponse(
			issue?.message ??
				"Invalid request body",
			400
		);
	}

	try {
		const {
			mac_address,
			firmware,
			fw_url,
		} = parsed.data;

		const device =
			await prisma.fota.findUnique({
				where: {
					mac_address,
				},
			});

		if (!device) {
			return errorResponse(
				"mac_address not found in fota",
				404
			);
		}

		const updated =
			await prisma.fota.update({
				where: {
					mac_address,
				},
				data: {
					firmware,
					link: fw_url,
				},
			});

		return successResponse(
			"Firmware updated successfully",
			{
				firmware:
					updated.firmware,

				fw_url:
					updated.link,
			},
			200
		);
	} catch (error: unknown) {
		if (error instanceof ApiError) {
			return errorResponse(
				error.message,
				error.statusCode
			);
		}

		return errorResponse(
			"Failed to update firmware",
			500
		);
	}
}

export const GET =
	withRequestLogging(
		getFotaRoute,
		{
			routeName:
				"device.fota.get",
		}
	);

export const PUT =
	withRequestLogging(
		updateFotaRoute,
		{
			routeName:
				"device.fota.update",
		}
	);