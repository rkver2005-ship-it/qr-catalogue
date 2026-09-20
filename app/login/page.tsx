"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const supabase = createClient();

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");

    if (!email || !password) {
      setError("Email aur password required hai");
      return;
    }

    setLoading(true);

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
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
          onChange={(e) =>
            setEmail(e.target.value)
          }
          className="mb-3 w-full rounded-lg border p-3"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          className="mb-3 w-full rounded-lg border p-3"
        />

        {error && (
          <p className="mb-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full rounded-lg bg-black p-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

      </div>
    </main>
  );
}