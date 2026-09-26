"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] =
    useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function checkRecoverySession() {
      const { data } =
        await supabase.auth.getSession();

      if (!data.session) {
        setError(
          "Password reset link invalid ya expire ho gaya hai. Please naya reset link request karo."
        );
      }

      setCheckingSession(false);
    }

    checkRecoverySession();
  }, [supabase]);

  async function handleUpdatePassword() {
    setError("");
    setSuccess("");

    if (!password || !confirmPassword) {
      setError("Please enter both password fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    setLoading(true);

    const { data } =
      await supabase.auth.getSession();

    if (!data.session) {
      setError(
        "Password reset session nahi mila. Please naya reset link request karo."
      );
      setLoading(false);
      return;
    }

    const { error: updateError } =
      await supabase.auth.updateUser({
        password,
      });

    if (updateError) {
      console.error(updateError);
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(
      "Password updated successfully."
    );

    setTimeout(() => {
      router.push("/login");
    }, 1500);
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-5 text-black">
        <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow">
          <p className="text-gray-600">
            Checking password reset link...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-5 text-black">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow">
        <h1 className="mb-2 text-2xl font-bold">
          Change Password
        </h1>

        <p className="mb-6 text-gray-500">
          Enter your new password below.
        </p>

        <input
          type="password"
          placeholder="New Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          className="mb-3 w-full rounded-lg border p-3"
        />

        <input
          type="password"
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChange={(e) =>
            setConfirmPassword(e.target.value)
          }
          className="mb-3 w-full rounded-lg border p-3"
        />

        {error && (
          <p className="mb-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {success && (
          <p className="mb-3 text-sm text-green-600">
            {success}
          </p>
        )}

        <button
          onClick={handleUpdatePassword}
          disabled={loading || !!error}
          className="w-full rounded-lg bg-black p-3 font-semibold text-white disabled:opacity-50"
        >
          {loading
            ? "Updating..."
            : "Update Password"}
        </button>
      </div>
    </main>
  );
}