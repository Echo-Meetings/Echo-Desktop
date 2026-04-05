import React from "react";

interface EchoLogoProps {
  size?: number;
}

export const EchoLogo: React.FC<EchoLogoProps> = ({ size = 28 }) => {
  // 5 vertical bars (equalizer style) matching the app icon
  // Bar positions and heights from in-app.svg, normalized to 24x24 viewBox
  const bars = [
    { x: 4.5, y: 9.2, h: 5.6 },    // shortest outer
    { x: 8.2, y: 7.0, h: 10.0 },   // medium
    { x: 11.9, y: 5.5, h: 13.0 },  // tallest center
    { x: 15.6, y: 7.0, h: 10.0 },  // medium
    { x: 19.3, y: 9.2, h: 5.6 },   // shortest outer
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={bar.y}
          width={2.2}
          height={bar.h}
          rx={1.1}
          fill="currentColor"
        />
      ))}
    </svg>
  );
};
