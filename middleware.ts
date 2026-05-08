import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import { resolveAuthSecret } from "@/lib/auth-secret";
import {
  getPortalSectorFromEmail,
  isRouteAllowedForSector,
} from "@/lib/portal-sector";

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token;
    const email = typeof token?.email === "string" ? token.email : undefined;
    const sector = getPortalSectorFromEmail(email);
    const path = req.nextUrl.pathname;

    if (!isRouteAllowedForSector(path, sector)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    secret: resolveAuthSecret(),
    pages: {
      signIn: "/",
      error: "/auth/error",
    },
  },
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/entrada-dados/:path*",
    "/admin",
    "/admin/:path*",
    "/administrativo/:path*",
    "/financeiro/:path*",
    "/juridico/:path*",
    "/contabil/:path*",
    "/marketing/:path*",
    "/eventos/:path*",
  ],
};
