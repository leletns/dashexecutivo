import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const runtime = "edge";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #c4b5fd 0%, #a78bfa 45%, #8b5cf6 100%)",
          borderRadius: 40,
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 44 44"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon points="22,4 38,18 22,22 6,18" fill="#ffffff" opacity="0.95" />
          <polygon points="6,18 22,22 22,40" fill="#ffffff" opacity="0.55" />
          <polygon points="38,18 22,22 22,40" fill="#ffffff" opacity="0.78" />
          <polygon points="13,11 22,4 31,11 22,15" fill="#ffffff" opacity="0.45" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
