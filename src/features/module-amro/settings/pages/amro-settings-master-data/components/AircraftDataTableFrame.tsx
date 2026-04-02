import { type ReactNode } from 'react';

type AircraftDataTableFrameProps = {
  controls?: ReactNode;
  children: ReactNode;
};

export function AircraftDataTableFrame({ controls, children }: AircraftDataTableFrameProps) {
  return (
    <div className="rounded-md border">
      {controls}
      <div className="overflow-auto max-h-[560px]">
        {children}
      </div>
    </div>
  );
}

export default AircraftDataTableFrame;
