import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import type { SessionCredential, Storage } from "./types";

const INDEX_KEY = "nightsignal.sessions.index.v1";
const MAX_SESSIONS = 20;

type IndexEntry = { id: string; storage: Storage; createdAt: number };

function tokenKey(entry: { id: string; storage: Storage }) {
  return `ns_token_${entry.storage}_${entry.id.replace(/[^A-Za-z0-9._-]/g, "_")}`;
}

export function newSessionToken(): string {
  return Array.from(Crypto.getRandomBytes(32), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readIndex(): Promise<IndexEntry[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveCredential(cred: SessionCredential): Promise<void> {
  await SecureStore.setItemAsync(tokenKey(cred), cred.token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  const index = [{ id: cred.id, storage: cred.storage, createdAt: cred.createdAt }, ...(await readIndex()).filter((e) => e.id !== cred.id)];
  for (const dropped of index.slice(MAX_SESSIONS)) await SecureStore.deleteItemAsync(tokenKey(dropped));
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index.slice(0, MAX_SESSIONS)));
}

export async function loadCredentials(): Promise<SessionCredential[]> {
  const creds: SessionCredential[] = [];
  for (const entry of await readIndex()) {
    const token = await SecureStore.getItemAsync(tokenKey(entry));
    if (token) creds.push({ ...entry, token });
  }
  return creds;
}
