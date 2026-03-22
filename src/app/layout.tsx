import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NQG on Monad — Neural Quorum Governance",
  description: "Reputation-based anonymous voting with passkey authentication on Monad L1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <nav className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <a href="/" className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <span className="text-xl font-bold gradient-text">NQG</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>on Monad</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/create" className="btn-secondary text-sm" style={{ padding: '8px 16px' }}>
              + Admin: poll
            </a>
            <div id="auth-status" />
          </div>
        </nav>
        <main className="max-w-4xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
