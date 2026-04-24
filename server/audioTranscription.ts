import { pipeline, env } from "@xenova/transformers";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import wavefile from "wavefile";
import { Readable, Writable } from "node:stream";

const { WaveFile } = wavefile;

// Use local cache for huggingface models
env.allowLocalModels = true;
env.backends.onnx.wasm.numThreads = 1; // Prevent high CPU lockup when transcribing

// Use fluent-ffmpeg with the static binary
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

// Global cached pipeline instance
let whisperPipeline: any = null;

async function getPipeline() {
  if (!whisperPipeline) {
    whisperPipeline = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
      quantized: true,
    });
  }
  return whisperPipeline;
}

/**
 * Converts any audio buffer into a 16kHz Mono WAV buffer
 */
async function convertAudioToWav(audioBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputStream = new Readable();
    inputStream.push(audioBuffer);
    inputStream.push(null);

    const outChunks: Buffer[] = [];
    const outputStream = new Writable({
      write(chunk, encoding, callback) {
        outChunks.push(chunk);
        callback();
      },
    });

    ffmpeg(inputStream)
      .inputFormat("any")
      // Convert to 16kHz, 1 channel (mono), pcm_s16le (standard wav format)
      .outputOptions([
        "-ar 16000",
        "-ac 1",
        "-c:a pcm_s16le",
        "-f wav",
      ])
      .on("error", (err: any) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .on("end", () => {
        resolve(Buffer.concat(outChunks));
      })
      .pipe(outputStream, { end: true });
  });
}

/**
 * Normalizes WAV buffer to Float32Array
 */
function wavBufferToFloat32(wavBuffer: Buffer): Float32Array {
  const wav = new WaveFile(wavBuffer);
  // Ensure the sample values are decoded into an array
  wav.toBitDepth("32f"); // Convert to 32-bit floating point precision
  const samples = wav.getSamples(false); // get samples as Float64Array
  return new Float32Array(samples);
}

/**
 * Main entrypoint to extract text from an audio file buffer.
 */
export async function transcribeAudioBuffer(audioBuffer: Buffer): Promise<string> {
  const transcriber = await getPipeline();
  const wavBuffer = await convertAudioToWav(audioBuffer);
  const audioData = wavBufferToFloat32(wavBuffer);

  const result = await transcriber(audioData, {
    chunk_length_s: 30, // For longer audio
    stride_length_s: 5, // Overlap for smoother chunking
    language: "el",     // Target language (Greek ASR)
    task: "transcribe",
    return_timestamps: false
  });

  if (Array.isArray(result)) {
    return result.map(t => t.text).join(" ").trim();
  }
  
  return result.text || "";
}
