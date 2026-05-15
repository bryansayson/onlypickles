import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const contentType = "image/png";
export const size = { width: 180, height: 180 };

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#09090b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            background: "#a3e635",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 120,
              height: 120,
              borderRadius: "50%",
              border: "7px solid #65a30d",
              boxSizing: "border-box",
            }}
          />
          <div style={{ position: "absolute", width: 0, height: 96, borderLeft: "5px solid #65a30d", borderRadius: 4 }} />
          <div style={{ position: "absolute", width: 96, height: 0, borderTop: "5px solid #65a30d", borderRadius: 4 }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
