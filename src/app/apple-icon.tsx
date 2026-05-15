import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const contentType = "image/png";
export const size = { width: 180, height: 180 };

const HOLES = [
  [-28, -42], [0, -42], [28, -42],
  [-42, -14], [-14, -14], [14, -14], [42, -14],
  [-28, 14], [0, 14], [28, 14],
  [-42, 42], [-14, 42], [14, 42], [42, 42],
] as [number, number][];

export default function AppleIcon() {
  const s = 180;
  const cx = s / 2;
  const cy = s / 2;
  const ballR = 74;
  const holeR = 8;

  return new ImageResponse(
    (
      <div
        style={{
          width: s,
          height: s,
          background: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
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
    { ...size }
  );
}
