export class BatchPipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BatchPipelineError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InsufficientBatchCapacityError extends BatchPipelineError {
  readonly requiredBytes: number;
  readonly availableBytes: number;

  constructor(requiredBytes: number, availableBytes: number) {
    super(
      `Insufficient batch capacity across carriers. Required: ${requiredBytes} bytes, Available: ${availableBytes} bytes.`,
    );
    this.name = 'InsufficientBatchCapacityError';
    this.requiredBytes = requiredBytes;
    this.availableBytes = availableBytes;
  }
}

export class ChunkReassemblyError extends BatchPipelineError {
  constructor(reason: string) {
    super(`Failed to reassemble multi-carrier payload chunks: ${reason}`);
    this.name = 'ChunkReassemblyError';
  }
}
