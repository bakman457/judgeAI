// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)
// Falls back to local filesystem when no proxy is configured

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ENV } from './_core/env';

type StorageConfig = { baseUrl: string; apiKey: string };

export function getLocalUploadsDir() {
  if (process.env.JUDGE_AI_UPLOADS_DIR) {
    return process.env.JUDGE_AI_UPLOADS_DIR;
  }
  if (process.env.JUDGE_AI_DATA_DIR) {
    return path.join(process.env.JUDGE_AI_DATA_DIR, "uploads");
  }
  return path.join(process.cwd(), "uploads");
}

const UPLOADS_DIR = getLocalUploadsDir();

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const segmentStart = relKey.lastIndexOf("/");
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1 || lastDot <= segmentStart) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

function getLocalUrl(key: string): string {
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}/uploads/${key}`;
}

function writeLocalFile(key: string, data: Buffer | Uint8Array | string) {
  ensureUploadsDir();
  const filePath = path.join(UPLOADS_DIR, key);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, data);
  return filePath;
}

const useLocalStorage = !ENV.forgeApiUrl || !ENV.forgeApiKey;

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (useLocalStorage) {
    const key = appendHashSuffix(normalizeKey(relKey));
    writeLocalFile(key, data);
    return { key, url: getLocalUrl(key) };
  }

  const { baseUrl, apiKey } = getStorageConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const key = normalizeKey(relKey);

  if (useLocalStorage) {
    return { key, url: getLocalUrl(key) };
  }

  const { baseUrl, apiKey } = getStorageConfig();
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}

/**
 * Reads the raw file bytes for a stored object. Uses the filesystem directly
 * when local-storage mode is active; otherwise fetches via the presigned
 * download URL. Used by server-side bundle exports that need to zip files.
 */
export async function storageGetBuffer(relKey: string): Promise<Buffer> {
  const key = normalizeKey(relKey);
  if (useLocalStorage) {
    ensureUploadsDir();
    const filePath = path.join(UPLOADS_DIR, key);
    return fs.promises.readFile(filePath);
  }
  const { baseUrl, apiKey } = getStorageConfig();
  const url = await buildDownloadUrl(baseUrl, key, apiKey);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Storage download failed (${response.status} ${response.statusText}) for key ${key}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
