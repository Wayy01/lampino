import { ImageResponse } from "next/og";
import { BRAND_MARK_DATA_URI } from "@/lib/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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
          background: "#f6f4ef",
        }}
      >
        <img src={BRAND_MARK_DATA_URI} width={132} height={132} alt="" />
      </div>
    ),
    size,
  );
}
