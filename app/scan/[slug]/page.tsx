
"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ScanPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const qrToken = searchParams.get("qr");
  const [message, setMessage] = useState("QR session shuru ho raha hai...");

  useEffect(() => {
    let cancelled = false;

    async function startSession() {
      if (!slug || !qrToken) {
        setMessage("QR link invalid hai. Dobara scan karein.");
        return;
      }

      const supabase = createClient();

      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (businessError || !business) {
        if (!cancelled) setMessage("Business nahi mila.");
        return;
      }

      const sessionId = crypto.randomUUID();

      const { data, error } = await supabase.rpc(
        "start_qr_menu_session",
        {
          p_business_id: business.id,
          p_qr_token: qrToken,
          p_session_id: sessionId,
        }
      );

      if (error) {
        console.error("QR session error:", error);
        if (!cancelled) {
          setMessage("Session shuru nahi hua. QR dobara scan karein.");
        }
        return;
      }

      const session = Array.isArray(data) ? data[0] : data;

      if (!session?.session_id || !session?.expires_at) {
        if (!cancelled) setMessage("Session details nahi mili.");
        return;
      }

      if (cancelled) return;

      const target = new URL(
        `/menu/${encodeURIComponent(slug)}`,
        window.location.origin
      );

      target.searchParams.set("qr", qrToken);
      target.searchParams.set("sid", session.session_id);

      window.location.replace(target.toString());
    }

    startSession();

    return () => {
      cancelled = true;
    };
  }, [slug, qrToken]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-6 text-black">
      <p>{message}</p>
    </main>
  );
}
