"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: "#f5f2ec",
          color: "#1d1b18",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <main style={{ width: "100%", maxWidth: "440px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
            }}
          >
            Vetto
          </p>
          <h1
            style={{
              margin: "24px 0 0",
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: "32px",
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            The application could not start.
          </h1>
          <p
            style={{
              margin: "16px 0 0",
              fontSize: "14px",
              lineHeight: 1.65,
              color: "#575148",
            }}
          >
            VETTO could not render this page. Reload the workspace to try again.
            If the problem continues, check the deployment logs.
          </p>
          {error.digest ? (
            <p
              style={{
                margin: "16px 0 0",
                fontSize: "11px",
                color: "#6e675c",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "24px",
              height: "40px",
              padding: "0 16px",
              border: 0,
              borderRadius: "6px",
              backgroundColor: "#1d1b18",
              color: "#fffdfa",
              fontFamily: "inherit",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload workspace
          </button>
        </main>
      </body>
    </html>
  );
}
