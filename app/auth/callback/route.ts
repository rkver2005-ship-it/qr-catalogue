import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/update-password";

  if (!code) {
    return NextResponse.redirect(
      new URL("/login", url.origin)
    );
  }

  const response = NextResponse.redirect(
    new URL(next, url.origin)
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.headers
            .get("cookie")
            ?.split(";")
            .map((cookie) => {
              const [name, ...value] =
                cookie.trim().split("=");

              return {
                name,
                value: value.join("="),
              };
            }) || [];
        },

        setAll(cookiesToSet) {
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
    console.error(error);

    return NextResponse.redirect(
      new URL(
        "/login?error=password-reset",
        url.origin
      )
    );
  }

  return response;
}