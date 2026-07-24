import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{
    path: string[];
  }>;
}

async function proxyRequest(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const { path } = await context.params;
  const apiUrl =
    process.env.PALCENTER_API_INTERNAL_URL?.replace(/\/+$/, "") ??
    "http://127.0.0.1:3001";
  const target = new URL(`/api/${path.join("/")}`, apiUrl);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const cookie = request.headers.get("cookie");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (cookie) {
    headers.set("cookie", cookie);
  }

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.arrayBuffer(),
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    const responseContentType = response.headers.get("content-type");
    const setCookie = response.headers.get("set-cookie");

    if (responseContentType) {
      responseHeaders.set("content-type", responseContentType);
    }

    if (setCookie) {
      responseHeaders.set("set-cookie", setCookie);
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("PalCenter API proxy request failed.", error);

    return Response.json(
      {
        error: "api_unreachable",
        message: "Unable to reach the PalCenter API.",
      },
      { status: 502 },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
