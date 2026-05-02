import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";
export const runtime = "edge";

export default function Icon() {
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
          borderRadius: 14,
        }}
      >
        <svg
          width="44"
          height="44"
          viewBox="0 0 44 44"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Faceta superior do diamante (mais clara) */}
          <polygon
            points="22,4 38,18 22,22 6,18"
            fill="#ffffff"
            opacity="0.95"
          />
          {/* Cintilha lateral esquerda */}
          <polygon points="6,18 22,22 22,40" fill="#ffffff" opacity="0.55" />
          {/* Cintilha lateral direita */}
          <polygon points="38,18 22,22 22,40" fill="#ffffff" opacity="0.78" />
          {/* Brilho central */}
          <polygon
            points="13,11 22,4 31,11 22,15"
            fill="#ffffff"
            opacity="0.45"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
