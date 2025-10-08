import React from 'react';

type TitleStripProps = {
  label: string;
  className?: string;
};

// Displays a small colored strip next to a list title.
// The color is driven by the CSS variable `--title-strip` (HSL), customizable via Theme Management.
export const TitleStrip: React.FC<TitleStripProps> = ({ label, className }) => {
  return (
    <div className={`flex items-center gap-3 ${className || ''}`}>
      <div
        className="h-5 w-1.5 rounded"
        style={{ backgroundColor: 'hsl(var(--title-strip))' }}
      />
      <div className="text-lg font-semibold">{label}</div>
    </div>
  );
};

export default TitleStrip;