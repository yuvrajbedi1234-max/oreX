export interface NavItem {
  label: string;
  href: string;
  comingSoon: boolean;
}

// Every item routes somewhere — Phase 1/2 only wire up real data behind
// Overview, Projects, Xero Connection and Demo; the rest render a
// "coming soon" placeholder.
export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", comingSoon: false },
  { label: "Projects", href: "/projects", comingSoon: false },
  { label: "Scope Inbox", href: "/scope-inbox", comingSoon: true },
  { label: "Variations", href: "/variations", comingSoon: true },
  { label: "Xero Connection", href: "/xero", comingSoon: false },
  { label: "Demo", href: "/demo", comingSoon: false },
  { label: "Settings", href: "/settings", comingSoon: true },
];
