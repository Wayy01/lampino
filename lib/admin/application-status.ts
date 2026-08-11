// Rental-application vocabulary, shared by the applications UI and its server
// actions. Applications start life as "pending" (see lib/actions/rentals.ts)
// and are triaged by the team from there.
export const APPLICATION_STATUSES = [
  "pending",
  "approved",
  "completed",
  "rejected",
  "cancelled",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// Mirrors the event types the public rental form submits.
export const EVENT_TYPES = [
  "wedding",
  "corporate",
  "birthday",
  "private",
  "other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
