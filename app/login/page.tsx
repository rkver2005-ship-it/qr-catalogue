"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  async function handleLogin() {
    setError("");
    setResetMessage("");

    if (!email || !password) {
      setError("Email aur password required hai");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (loginError) {
        setError(loginError.message);
        setLoading(false);
        return;
      }

      router.push("/");
    } catch (err) {
      console.error(err);
      setError("Login failed. Please try again.");
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setResetMessage("");

    if (!email) {
      setError("Pehle apna email enter karo");
      return;
    }

    setResetLoading(true);

    try {
      const supabase = createClient();

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo:
            "https://qr-catalogue-tptv.vercel.app/auth/callback?next=/update-password",
        });

      if (resetError) {
        console.error(resetError);
        setError(resetError.message);
        setResetLoading(false);
        return;
      }

      setResetMessage(
        "Password reset link aapke email par bhej diya gaya hai."
      );
    } catch (err) {
      console.error(err);
      setError(
        "Password reset request failed. Please try again."
      );
    }

    setResetLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-5 text-black">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow">
        <h1 className="mb-2 text-2xl font-bold">
          Admin Login
        </h1>

        <p className="mb-6 text-gray-500">
          Login to manage your restaurant
        </p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded-lg border p-3"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-3 w-full rounded-lg border p-3"
        />

        {error && (
          <p className="mb-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {resetMessage && (
          <p className="mb-3 text-sm text-green-600">
            {resetMessage}
          </p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full rounded-lg bg-black p-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <button
          onClick={handleForgotPassword}
          disabled={resetLoading}
          className="mt-3 w-full p-2 text-sm font-semibold text-blue-600"
        >
          {resetLoading
            ? "Sending reset link..."
            : "Forgot Password?"}
        </button>
      </div>
    </main>
  );
}