export const COOKIE_NAME = "app_session_id";
export const APP_VERSION = "1.0.0";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
export const MAX_UPLOAD_BYTES = 400 * 1024 * 1024;
export const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / 1024 / 1024;
// Base64 JSON uploads are roughly 33% larger than the original file.
export const API_UPLOAD_BODY_LIMIT = "600mb";
