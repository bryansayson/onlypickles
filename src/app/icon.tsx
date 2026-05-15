import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const contentType = "image/png";

const HOLES = [
  // row y=-120
  [-80, -120], [0, -120], [80, -120],
  // row y=-80
  [-120, -80], [-40, -80], [40, -80], [120, -80],
  // row y=-40
  [-80, -40], [0, -40], [80, -40],
  // row y=0
  [-120, 0], [-40, 0], [40, 0], [120, 0],
  // row y=40
  [-80, 40], [0, 40], [80, 40],
  // row y=80
  [-120, 80], [-40, 80], [40, 80], [120, 80],
  // row y=120
  [-80, 120], [0, 120], [80, 120],
] as [number, number][];

export default function Icon() {
  const size = 512;
  const cx = size / 2;
  const cy = size / 2;
  const ballR = 210;
  const holeR = 22;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: "#000000",
          borderRadius: 96,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Ball */}
        <div
          style={{
            width: ballR * 2,
            height: ballR * 2,
            background: "#84cc16",
            borderRadius: "50%",
            position: "absolute",
            top: cy - ballR,
            left: cx - ballR,
          }}
        />
        {/* Holes */}
        {HOLES.map(([dx, dy], i) => (
          <div
            key={i}
            style={{
              width: holeR * 2,
              height: holeR * 2,
              background: "#000000",
              borderRadius: "50%",
              position: "absolute",
              top: cy + dy - holeR,
              left: cx + dx - holeR,
            }}
          />
        ))}
      </div>
    ),
    { width: size, height: size }
  );
}
