import { describe, it, expect } from "vitest";

type RestoreProgressState = {
  table: string | null;
  processedRows: number;
  totalRows: number;
  restoredRows: number;
  failedRows: number;
  batchIndex: number;
  totalBatches: number;
  currentTableIndex: number;
  totalTableCount: number;
  elapsedMs: number;
  etaMs: number;
  stage: string;
  bytesProcessed: number;
  totalBytes: number;
  mbPerSecond: number;
};

const updateProgress = (
  prev: RestoreProgressState,
  processedRows: number,
  totalRows: number,
  totalBytes: number,
  startTime: number,
  now: number
): RestoreProgressState => {
  const elapsedMs = now - startTime;
  const bytesProcessed = Math.min(
    totalBytes,
    Math.floor((processedRows / Math.max(totalRows, 1)) * totalBytes)
  );
  const rowsPerMs =
    processedRows > 0 && elapsedMs > 0 ? processedRows / elapsedMs : 0;
  const remainingRows = totalRows - processedRows;
  const etaMs = rowsPerMs > 0 ? remainingRows / rowsPerMs : 0;
  const bytesPerMs = elapsedMs > 0 ? bytesProcessed / elapsedMs : 0;
  const mbPerSecond =
    bytesPerMs > 0 ? (bytesPerMs * 1000) / (1024 * 1024) : 0;

  return {
    ...prev,
    processedRows,
    totalRows,
    elapsedMs,
    etaMs,
    bytesProcessed,
    totalBytes,
    mbPerSecond,
  };
};

describe("restore progress calculations", () => {
  it("computes ETA and throughput based on rows and bytes", () => {
    const start = 0;
    const now = 1000;
    const totalRows = 1000;
    const totalBytes = 1024 * 1024;

    const initial: RestoreProgressState = {
      table: "public.test",
      processedRows: 0,
      totalRows,
      restoredRows: 0,
      failedRows: 0,
      batchIndex: 1,
      totalBatches: 10,
      currentTableIndex: 1,
      totalTableCount: 1,
      elapsedMs: 0,
      etaMs: 0,
      stage: "Restoring tables",
      bytesProcessed: 0,
      totalBytes,
      mbPerSecond: 0,
    };

    const updated = updateProgress(initial, 500, totalRows, totalBytes, start, now);

    expect(updated.processedRows).toBe(500);
    expect(updated.totalRows).toBe(totalRows);
    expect(updated.elapsedMs).toBe(1000);
    expect(updated.bytesProcessed).toBeCloseTo(totalBytes / 2, 0);
    expect(updated.mbPerSecond).toBeGreaterThan(0);
    expect(updated.etaMs).toBeGreaterThan(0);
  });
});

