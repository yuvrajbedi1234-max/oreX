import "server-only";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import type { StoredXeroConnection, TokenSet } from "./types";

// Single-user hackathon MVP: exactly one connection row, at a fixed id.
const SINGLETON_ID = "singleton";

interface EncryptedPayload {
  tokenSet: TokenSet;
  connectionId: string;
}

export async function saveConnection(params: {
  tenantId: string;
  tenantName: string;
  connectionId: string;
  tokenSet: TokenSet;
}): Promise<void> {
  const payload: EncryptedPayload = {
    tokenSet: params.tokenSet,
    connectionId: params.connectionId,
  };

  await prisma.xeroConnection.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      tenantId: params.tenantId,
      tenantName: params.tenantName,
      encryptedTokenSet: encrypt(JSON.stringify(payload)),
    },
    update: {
      tenantId: params.tenantId,
      tenantName: params.tenantName,
      encryptedTokenSet: encrypt(JSON.stringify(payload)),
    },
  });
}

export async function getConnection(): Promise<StoredXeroConnection | null> {
  const row = await prisma.xeroConnection.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) return null;

  const payload = JSON.parse(decrypt(row.encryptedTokenSet)) as EncryptedPayload;
  return {
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    tokenSet: payload.tokenSet,
    connectionId: payload.connectionId,
    updatedAt: row.updatedAt,
  };
}

export async function clearConnection(): Promise<void> {
  await prisma.xeroConnection.deleteMany({ where: { id: SINGLETON_ID } });
}
