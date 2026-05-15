import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#09090b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 96,
        }}
      >
        {/* Pickleball */}
        <div
          style={{
            width: 320,
            height: 320,
            background: "#a3e635",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {/* Seam lines */}
          <div
            style={{
              position: "absolute",
              width: 320,
              height: 320,
              borderRadius: "50%",
              border: "18px solid #65a30d",
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 0,
              height: 260,
              borderLeft: "14px solid #65a30d",
              top: 30,
              borderRadius: 8,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 260,
              height: 0,
              borderTop: "14px solid #65a30d",
              left: 30,
              borderRadius: 8,
            }}
          />
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
