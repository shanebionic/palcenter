import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const apiUrl =
    process.env.PALCENTER_API_INTERNAL_URL?.replace(/\/+$/, "") ??
    "http://127.0.0.1:3001";

  try {
    const response = await fetch(`${apiUrl}/api/auth/session`, {
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    if (response.ok) {
      return NextResponse.next();
    }
  } catch (error) {
    console.error("Unable to validate the PalCenter session.", error);
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
