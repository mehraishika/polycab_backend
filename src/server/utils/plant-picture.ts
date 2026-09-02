import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_PLANT_PICTURE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function savePlantPicture(file: File): Promise<string> {
  if (file.size === 0) {
    throw new Error("Plant picture cannot be empty");
  }

  if (file.size > MAX_PLANT_PICTURE_SIZE) {
    throw new Error("Plant picture must be 5MB or smaller");
  }

  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error("Plant picture must be a JPEG, PNG, or WebP image");
  }

  const extension = path.extname(file.name).toLowerCase() ||
    (file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg");
  const fileName = `${randomUUID()}${extension}`;
  const storageDirectory = path.join(process.cwd(), "public", "uploads", "plants");
  // const storageDirectory = path.join(process.cwd(), "uploads", "plants");
  const relativePath = path.posix.join("uploads", "plants", fileName);

  await mkdir(storageDirectory, { recursive: true });
  await writeFile(path.join(storageDirectory, fileName), Buffer.from(await file.arrayBuffer()));

  return relativePath;
}

export async function readPlantRequest(request: Request): Promise<{
  body: Record<string, unknown>;
  picture?: File;
}> {
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    const body = await request.json();
    return { body: body as Record<string, unknown> };
  }

  const formData = await request.formData();
  const pictureEntry = ["picture", "pictureFile", "file"]
    .map((fieldName) => formData.get(fieldName))
    .find((value): value is File => value instanceof File && value.size > 0);
  const body = Object.fromEntries(
    Array.from(formData.entries()).filter(([fieldName]) =>
      !["picture", "pictureFile", "file"].includes(fieldName),
    ),
  ) as Record<string, unknown>;

  for (const fieldName of ["kwp", "price"]) {
    if (typeof body[fieldName] === "string" && body[fieldName] !== "") {
      body[fieldName] = Number(body[fieldName]);
    }
  }

  if (typeof body.fromService === "string") {
    body.fromService = body.fromService === "true";
  }

  return { body, picture: pictureEntry };
}