import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { Contact } from "./types";

export function ContactsPreview({
  contacts,
  error,
  connected,
}: {
  contacts: Contact[] | null;
  error: string | null;
  connected: boolean;
}) {
  return (
    <Card>
      <CardHeader title="Contacts" subtitle="Used to pick who a variation quote is addressed to." />
      <CardBody>
        {!connected && <p className="text-sm text-ink-500">Connect to Xero to see contacts.</p>}
        {connected && error && <p className="text-sm text-red-600">{error}</p>}
        {connected && !error && contacts === null && <p className="text-sm text-ink-500">Loading contacts…</p>}
        {connected && !error && contacts !== null && contacts.length === 0 && (
          <p className="text-sm text-ink-500">No contacts found in this organisation.</p>
        )}
        {connected && !error && contacts !== null && contacts.length > 0 && (
          <ul className="flex flex-col divide-y divide-surface-border">
            {contacts.slice(0, 8).map((contact) => (
              <li key={contact.contactId ?? contact.name} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{contact.name ?? "Unnamed"}</p>
                  <p className="text-xs text-ink-500">{contact.emailAddress ?? "No email on file"}</p>
                </div>
                <Badge tone={contact.contactStatus === "ACTIVE" ? "green" : "neutral"}>
                  {contact.contactStatus ?? "—"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
