import { useSyncExternalStore } from "react";
import { memberOfDevice } from "../model/approvals";
import type { Member } from "../model/types";
import { deviceId, readLocalAuthor } from "./storage";

/** This device's id and its author's name, which tell which board member it is. */
export interface Identity {
  deviceId: string;
  authorName: string;
}

const listeners = new Set<() => void>();
let current: Identity | undefined;

function read(): Identity {
  current ??= { deviceId: deviceId(), authorName: readLocalAuthor() };
  return current;
}

/** Reads the author's name again after it changed. */
export function refreshIdentity() {
  const next = { deviceId: deviceId(), authorName: readLocalAuthor() };
  if (current && next.deviceId === current.deviceId && next.authorName === current.authorName) return;
  current = next;
  for (const listener of listeners) listener();
}

/** This device's id and author's name, kept up to date. */
export function useIdentity(): Identity {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, read);
}

/** The member of `members` who is this device (see `memberOfDevice`), kept up to date with the author's name. */
export function useMyMember(members: Member[] | undefined): Member | undefined {
  const identity = useIdentity();
  return memberOfDevice(members ?? [], identity.deviceId, identity.authorName);
}
