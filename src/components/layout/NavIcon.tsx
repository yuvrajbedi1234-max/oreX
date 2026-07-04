const PATHS: Record<string, string> = {
  "/": "M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9",
  "/projects": "M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z",
  "/scope-inbox": "M4 5h16v10l-3 4H7l-3-4V5Zm0 6h5l1.5 2h3L15 11h5",
  "/variations": "M12 3v4M12 17v4M4.2 4.2l2.9 2.9M16.9 16.9l2.9 2.9M3 12h4M17 12h4M4.2 19.8l2.9-2.9M16.9 7.1l2.9-2.9",
  "/xero": "M4 4h16v16H4zM8 8l8 8M16 8l-8 8",
  "/demo": "M12 2 3 7l9 5 9-5-9-5ZM3 12l9 5 9-5M3 17l9 5 9-5",
  "/settings": "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 1-.1 1.2l2 1.6-2 3.4-2.4-1a7.6 7.6 0 0 1-2 1.2L14.5 21h-4l-.4-2.6a7.6 7.6 0 0 1-2-1.2l-2.4 1-2-3.4 2-1.6A7.4 7.4 0 0 1 5.6 12a7.4 7.4 0 0 1 .1-1.2l-2-1.6 2-3.4 2.4 1a7.6 7.6 0 0 1 2-1.2L9.9 3h4l.4 2.6a7.6 7.6 0 0 1 2 1.2l2.4-1 2 3.4-2 1.6c.07.4.1.8.1 1.2Z",
};

export function NavIcon({ href, className }: { href: string; className?: string }) {
  const d = PATHS[href] ?? PATHS["/projects"];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}
