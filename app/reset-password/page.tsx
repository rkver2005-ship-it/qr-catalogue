"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRecoveryClient } from "@/lib/supabase/recovery-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleContinue() {
    setError("");
    setLoading(true);

    try {
      const params = new URLSearchParams(window.location.search);

      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      if (!tokenHash || type !== "recovery") {
        setError(
          "Password reset link invalid ya expire ho gaya hai. Please naya reset link request karo."
        );
        setLoading(false);
        return;
      }

      const supabase = createRecoveryClient();

      const { error: verifyError } =
        await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });

      if (verifyError) {
        console.error(verifyError);
        setError(
          "Password reset link invalid ya expire ho gaya hai. Please naya reset link request karo."
        );
        setLoading(false);
        return;
      }

      router.push("/update-password");
    } catch (err) {
      console.error(err);
      setError(
        "Password reset link verify nahi ho saka. Please naya reset link request karo."
      );
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f5f5f5",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          background: "#ffffff",
          borderRadius: "16px",
          padding: "32px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 700,
            marginBottom: "12px",
          }}
        >
          Reset Password
        </h1>

        <p
          style={{
            color: "#666",
            marginBottom: "24px",
          }}
        >
          Continue button dabakar password reset process complete karo.
        </p>

        {error && (
          <p
            style={{
              color: "#dc2626",
              marginBottom: "20px",
            }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleContinue}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            border: "none",
            borderRadius: "10px",
            background: loading ? "#9ca3af" : "#111827",
            color: "#ffffff",
            fontSize: "16px",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading
            ? "Verifying..."
            : "Continue to Reset Password"}
        </button>
      </div>
    </main>
  );
}