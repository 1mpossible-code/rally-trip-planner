import type { TripPlan, TripFormInputs, ChangeBlockPayload, VoiceIntentResponse, Block, Day } from "./types";

const BASE = import.meta.env.VITE_RALLY_API_BASE || "http://localhost:8080";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

/** Map API response shape to our frontend TripPlan shape */
function normalizeTripPlan(raw: any): TripPlan {
  const days: Day[] = (raw.itinerary ?? raw.days ?? []).map((d: any) => ({
    date: d.date,
    blocks: (d.blocks ?? []).map((b: any): Block => ({
      block_id: b.block_id,
      title: b.title,
      kind: b.kind,
      status: b.status,
      start_time: b.start_time ?? b.start_at,
      end_time: b.end_time ?? b.end_at,
      place_ref: b.place_ref,
      meta: b.meta,
      notes: b.notes,
    })),
  }));

  return {
    trip_id: raw.trip_id,
    timezone: raw.timezone,
    origin: raw.inputs?.origin ?? raw.origin ?? "",
    destinations: raw.inputs?.destinations ?? raw.destinations ?? [],
    start_date: raw.inputs?.start_date ?? raw.start_date ?? "",
    end_date: raw.inputs?.end_date ?? raw.end_date ?? "",
    budget_level: raw.inputs?.budget_level ?? raw.budget_level ?? "mid",
    interests: raw.inputs?.interests ?? raw.interests ?? [],
    neighborhoods: raw.inputs?.neighborhoods ?? raw.neighborhoods ?? [],
    days,
  };
}

export async function createTrip(input: TripFormInputs): Promise<TripPlan> {
  const res = await fetch(`${BASE}/v1/trips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const raw = await json<any>(res);
  return normalizeTripPlan(raw);
}

export async function skipBlock(tripId: string, blockId: string): Promise<TripPlan> {
  const res = await fetch(`${BASE}/v1/trips/${tripId}/blocks/${blockId}/skip`, {
    method: "POST",
  });
  const raw = await json<any>(res);
  return normalizeTripPlan(raw);
}

export async function changeBlock(
  tripId: string,
  blockId: string,
  payload: ChangeBlockPayload
): Promise<TripPlan> {
  const res = await fetch(`${BASE}/v1/trips/${tripId}/blocks/${blockId}/change`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const raw = await json<any>(res);
  return normalizeTripPlan(raw);
}

export async function voiceIntent(tripId: string, audioBlob: Blob): Promise<VoiceIntentResponse> {
  const form = new FormData();
  form.append("trip_id", tripId);
  form.append("audio", new File([audioBlob], "audio.webm", { type: audioBlob.type }));
  const res = await fetch(`${BASE}/v1/voice/intent`, {
    method: "POST",
    body: form,
  });
  const raw = await json<any>(res);
  return { ...raw, trip: normalizeTripPlan(raw.trip) };
}

export async function downloadCalendar(tripId: string): Promise<Blob> {
  const res = await fetch(`${BASE}/v1/trips/${tripId}/calendar.ics`);
  if (!res.ok) throw new Error(`Calendar download failed: ${res.status}`);
  return res.blob();
}
