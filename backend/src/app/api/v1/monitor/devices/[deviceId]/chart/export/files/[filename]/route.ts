import { promises as fs } from "fs";
import path from "path";
import type { NextRequest } from "next/server";

type Context = {
  params: Promise<{
    deviceId: string;
    filename: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: Context,
) {
  const { filename } = await context.params;

  try {
    const filePath = path.join(
      process.cwd(),
      "exports",
      filename,
    );

    const fileBuffer = await fs.readFile(filePath);

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return Response.json(
      { success: false, message: "File not found" },
      { status: 404 },
    );
  }
}