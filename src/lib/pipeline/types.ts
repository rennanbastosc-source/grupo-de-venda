export type CaptionStatus = "none" | "pending" | "ready" | "failed";

export type PipelineResult = {
  exported: number;
  captioned: number;
  imported: number;
  affiliates: number;
  enqueued: number;
  errors: string[];
};
