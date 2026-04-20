import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@shared/const";

export async function fileToBase64(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds ${MAX_UPLOAD_MB} MB limit`);
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read the selected file"));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

export async function filesToBatchPayload(files: File[]) {
  return Promise.all(
    files.map(async file => ({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      base64Content: await fileToBase64(file),
      metadataJson: { originalSize: file.size },
    })),
  );
}
