import { type ReactNode } from 'react';

type AircraftDataTableFrameProps = {
  controls?: ReactNode;
  beforeContent?: ReactNode;
  children: ReactNode;
};

export function AircraftDataTableFrame({ controls, beforeContent, children }: AircraftDataTableFrameProps) {
  return (
    <div className="rounded-md border">
      {controls}
      {beforeContent}
      <div className="overflow-auto max-h-[560px]">
        {children}
      </div>
    </div>
  );
}

export default AircraftDataTableFrame;
