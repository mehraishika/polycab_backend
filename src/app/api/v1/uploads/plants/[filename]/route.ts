import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ filename: string }>;
  },
) {
  const { filename } = await params;

  // Prevent path traversal
  const safeFilename = path.basename(filename);

  const extension = path.extname(safeFilename).toLowerCase();
  const contentType = CONTENT_TYPES[extension];

  if (!contentType) {
    return new Response("Unsupported image type", {
      status: 400,
    });
  }

  const filePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    "plants",
    safeFilename,
  );

  try {
    const file = await readFile(filePath);

    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Image not found", {
      status: 404,
    });
  }
}