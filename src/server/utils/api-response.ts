import { NextResponse } from 'next/server';

export function successResponse<T>(
	message: string,
	data: T,
	status = 200,
): Response {
	return NextResponse.json(
		{
			success: true,
			message,
			data,
		},
		{ status },
	);
}

export function errorResponse(message: string, status: number): Response {
	return NextResponse.json(
		{
			success: false,
			message,
		},
		{ status },
	);
}
