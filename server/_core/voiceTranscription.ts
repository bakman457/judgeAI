/**
 * @deprecated This module is not currently used in the Judge AI application.
 * Remove if not needed, or integrate properly if voice transcription features are planned.
 * Last verified: April 2026
 */

/**
 * Voice transcription helper using internal Speech-to-Text service
 */
import { lookup } from "node:dns/promises";
import { URL } from "node:url";
import { ENV } from "./env";

export type TranscribeOptions = {
  audioUrl: string;
  language?: string;
  prompt?: string;
};

export type WhisperSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

export type WhisperResponse = {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
};

export type TranscriptionError = {
  error: string;
  code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "TRANSCRIPTION_FAILED" | "UPLOAD_FAILED" | "SERVICE_ERROR";
  details?: string;
};

async function assertPublicUrl(urlString: string) {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("Invalid audio URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Audio URL must use HTTP or HTTPS");
  }
  const hostname = url.hostname.toLowerCase();
  const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254", "metadata.google.internal", "metadata.azure.com"];
  if (blockedHosts.some(h => hostname === h || hostname.endsWith(`.${h}`))) {
    throw new Error("Audio URL resolves to a blocked host");
  }
  const addresses = await lookup(hostname, { all: true });
  for (const { address } of addresses) {
    if (address === "127.0.0.1" || address === "::1") throw new Error("Loopback not allowed");
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(address)) {
      throw new Error("Private IP range not allowed");
    }
  }
}

export async function transcribeAudio(
  options: TranscribeOptions
): Promise<WhisperResponse | TranscriptionError> {
  try {
    if (!ENV.forgeApiUrl) {
      return {
        error: "Voice transcription service is not configured",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_URL is not set",
      };
    }
    if (!ENV.forgeApiKey) {
      return {
        error: "Voice transcription service authentication is missing",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_KEY is not set",
      };
    }

    let audioBuffer: Buffer;
    let mimeType: string;
    try {
      await assertPublicUrl(options.audioUrl);
      const response = await fetch(options.audioUrl, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) {
        return {
          error: "Failed to download audio file",
          code: "INVALID_FORMAT",
          details: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      audioBuffer = Buffer.from(await response.arrayBuffer());
      mimeType = response.headers.get("content-type") || "audio/mpeg";
      const sizeMB = audioBuffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        return {
          error: "Audio file exceeds maximum size limit",
          code: "FILE_TOO_LARGE",
          details: `File size is ${sizeMB.toFixed(2)}MB, maximum allowed is 16MB`,
        };
      }
    } catch (error) {
      return {
        error: "Failed to fetch audio file",
        code: "SERVICE_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      };
    }

    const formData = new FormData();
    const filename = `audio.${getFileExtension(mimeType)}`;
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", audioBlob, filename);
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    const prompt = options.prompt || (
      options.language
        ? `Transcribe the user's voice to text, the user's working language is ${getLanguageName(options.language)}`
        : "Transcribe the user's voice to text"
    );
    formData.append("prompt", prompt);

    const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
    const fullUrl = new URL("v1/audio/transcriptions", baseUrl).toString();

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "Accept-Encoding": "identity",
      },
      body: formData,
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        error: "Transcription service request failed",
        code: "TRANSCRIPTION_FAILED",
        details: `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`,
      };
    }

    const whisperResponse = (await response.json()) as WhisperResponse;
    if (!whisperResponse.text || typeof whisperResponse.text !== "string") {
      return {
        error: "Invalid transcription response",
        code: "SERVICE_ERROR",
        details: "Transcription service returned an invalid response format",
      };
    }

    return whisperResponse;
  } catch (error) {
    return {
      error: "Voice transcription failed",
      code: "SERVICE_ERROR",
      details: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a",
  };
  return mimeToExt[mimeType] || "audio";
}

function getLanguageName(langCode: string): string {
  const langMap: Record<string, string> = {
    en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
    pt: "Portuguese", ru: "Russian", ja: "Japanese", ko: "Korean", zh: "Chinese",
    ar: "Arabic", hi: "Hindi", nl: "Dutch", pl: "Polish", tr: "Turkish",
    sv: "Swedish", da: "Danish", no: "Norwegian", fi: "Finnish",
  };
  return langMap[langCode] || langCode;
}
