import { NextResponse } from "next/server";

export function middleware(request) {
  const auth = request.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const i = decoded.indexOf(":");
      const user = decoded.slice(0, i);
      const pass = decoded.slice(i + 1);
      if (user === process.env.PANEL_USER && pass === process.env.PANEL_PASSWORD) {
        return NextResponse.next();
      }
    }
  }
  return new NextResponse("GrupTakip - Giris gerekli", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="GrupTakip", charset="UTF-8"', "Cache-Control":"no-store" }
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };