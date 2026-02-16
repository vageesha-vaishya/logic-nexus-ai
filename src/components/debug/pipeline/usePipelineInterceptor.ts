import { useEffect, useRef } from 'react';
import { usePipeline, PipelineStage } from './PipelineContext';

export function usePipelineInterceptor(
  stage: PipelineStage,
  data: any,
  metadata?: any,
  dependencies: any[] = []
) {
  const { capture } = usePipeline();
  const prevData = useRef<string | null>(null);

  useEffect(() => {
    const stringifiedData = JSON.stringify(data);
    
    // Only capture if data has changed to avoid spamming
    if (prevData.current !== stringifiedData) {
      capture(stage, data, metadata);
      prevData.current = stringifiedData;
    }
  }, [stage, capture, metadata, ...dependencies]);

  return { capture };
}
