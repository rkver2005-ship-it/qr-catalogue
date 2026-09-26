import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/login", url.origin)
    );
  }

  const cookieStore = await cookies();

  const response = NextResponse.redirect(
    new URL("/update-password", url.origin)
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(
            ({ name, value, options }) => {
              cookieStore.set(
                name,
                value,
                options
              );

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
    "Password recovery exchange error:",
    error
  );

  const errorUrl = new URL(
    "/login",
    url.origin
  );

  errorUrl.searchParams.set(
    "error",
    "password-reset"
  );

  errorUrl.searchParams.set(
    "message",
    error.message
  );

  return NextResponse.redirect(errorUrl);
}

  return response;
}