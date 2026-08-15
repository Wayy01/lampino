"use client";

// Last resort: a throw inside one of the two root layouts (`app/[lang]` or
// `app/admin/[lang]`) happens before any provider or stylesheet is mounted, so
// this file replaces the root layout entirely and must bring its own <html>,
// <body> and styling. No dictionary import either — the locale lives in a
// layout that, by definition, did not render.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="ro">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "#faf9f7",
          color: "#1a1a1a",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          textAlign: "center",
        }}
      >
        <title>Lampino</title>
        <main style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.75rem", fontWeight: 600 }}>
            Ceva n-a mers / Что-то пошло не так
          </h1>
          <p style={{ margin: "0 0 1.75rem", color: "#5c5c5c", lineHeight: 1.6 }}>
            Pagina nu a putut fi încărcată. Încearcă din nou.
            <br />
            Страницу не удалось загрузить. Попробуйте снова.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              cursor: "pointer",
              border: "none",
              borderRadius: "0.5rem",
              background: "#1a1a1a",
              color: "#fff",
              padding: "0.75rem 1.5rem",
              fontSize: "0.95rem",
            }}
          >
            Încearcă din nou / Попробовать снова
          </button>
          {error.digest && (
            <p
              style={{
                marginTop: "1.75rem",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#8a8a8a",
              }}
            >
              {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
