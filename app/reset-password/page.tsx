"use client";

import { useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const [confirmationUrl, setConfirmationUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get("confirmation_url");

    if (!url) {
      setError("Password reset link invalid hai.");
      return;
    }

    setConfirmationUrl(url);
  }, []);

  function handleContinue() {
    if (!confirmationUrl) {
      setError("Password reset link invalid hai.");
      return;
    }

    window.location.href = confirmationUrl;
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
          disabled={!confirmationUrl}
          style={{
            width: "100%",
            padding: "14px",
            border: "none",
            borderRadius: "10px",
            background: confirmationUrl ? "#111827" : "#9ca3af",
            color: "#ffffff",
            fontSize: "16px",
            fontWeight: 600,
            cursor: confirmationUrl ? "pointer" : "not-allowed",
          }}
        >
          Continue to Reset Password
        </button>
      </div>
    </main>
  );
}