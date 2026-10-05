import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/favicon.ico") {
    return NextResponse.rewrite(new URL("/icon", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/favicon.ico"],
};