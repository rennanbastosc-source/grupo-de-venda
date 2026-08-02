export type CaptionStatus = "none" | "pending" | "ready" | "failed";

export type PipelineResult = {
  captioned: number;
  affiliates: number;
  enqueued: number;
  mirrored: number;
  errors: string[];
};
