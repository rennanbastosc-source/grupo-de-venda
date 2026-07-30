import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (request.nextUrl.pathname.startsWith("/dashboard")) {
      const login = request.nextUrl.clone();
      login.pathname = "/login";
      return NextResponse.redirect(login);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isDashboard = path.startsWith("/dashboard");
  const isLogin = path === "/login";

  if (isDashboard && !user) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  if (isLogin && user) {
    const dash = request.nextUrl.clone();
    dash.pathname = "/dashboard";
    return NextResponse.redirect(dash);
  }

  return supabaseResponse;
}

/** Pure guard used by unit tests (no Next/Supabase). */
export function resolveAuthRedirect(
  path: string,
  hasUser: boolean,
): "/login" | "/dashboard" | null {
  if (path.startsWith("/dashboard") && !hasUser) return "/login";
  if (path === "/login" && hasUser) return "/dashboard";
  return null;
}
