import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();

  const code = url.searchParams.get("code");
  const next =
    url.searchParams.get("next") || "/update-password";

  if (!code) {
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.redirect(
    new URL(next, request.url)
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value }) => {
              request.cookies.set(name, value);
            }
          );

          response = NextResponse.redirect(
            new URL(next, request.url)
          );

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                options
              );
            }
          );
        },
      },
    }
  );

  const { error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error(
      "Password recovery callback error:",
      error
    );

    const errorUrl = new URL(
      "/login",
      request.url
    );

    errorUrl.searchParams.set(
      "error",
      "password-reset"
    );

    return NextResponse.redirect(errorUrl);
  }

  return response;
}