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
      const session = (await response.json()) as {
        user: { role: string; mustChangePassword: boolean };
      };
      if (
        session.user.mustChangePassword &&
        request.nextUrl.pathname !== "/profile"
      ) {
        return NextResponse.redirect(new URL("/profile", request.url));
      }
      if (
        ["/users", "/backup", "/notifications"].some((path) =>
          request.nextUrl.pathname.startsWith(path),
        ) &&
        session.user.role !== "administrator"
      ) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    }

    const setup = await fetch(`${apiUrl}/api/auth/setup-status`, {
      cache: "no-store",
    });
    if (
      setup.ok &&
      ((await setup.json()) as { setupRequired: boolean }).setupRequired
    ) {
      return NextResponse.redirect(new URL("/setup", request.url));
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
  matcher: ["/((?!api|login|setup|_next/static|_next/image|favicon.ico).*)"],
};
