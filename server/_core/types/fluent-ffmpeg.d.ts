declare module "fluent-ffmpeg" {
  type FfmpegCommand = {
    inputFormat(format: string): FfmpegCommand;
    outputOptions(options: string[]): FfmpegCommand;
    on(event: "error", listener: (error: Error) => void): FfmpegCommand;
    on(event: "end", listener: () => void): FfmpegCommand;
    pipe(stream: NodeJS.WritableStream, options?: { end?: boolean }): NodeJS.WritableStream;
  };

  type FfmpegFactory = {
    (input?: unknown): FfmpegCommand;
    setFfmpegPath(path: string): void;
  };

  const ffmpeg: FfmpegFactory;
  export default ffmpeg;
}
