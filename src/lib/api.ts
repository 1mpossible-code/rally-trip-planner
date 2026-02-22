import type { TripPlan, TripFormInputs, ChangeBlockPayload, VoiceIntentResponse } from "./types";

const BASE = import.meta.env.VITE_RALLY_API_BASE || "http://localhost:8080";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function createTrip(input: TripFormInputs): Promise<TripPlan> {
  const res = await fetch(`${BASE}/v1/trips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return json<TripPlan>(res);
}

export async function skipBlock(tripId: string, blockId: string): Promise<TripPlan> {
  const res = await fetch(`${BASE}/v1/trips/${tripId}/blocks/${blockId}/skip`, {
    method: "POST",
  });
  return json<TripPlan>(res);
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
  return json<TripPlan>(res);
}

export async function voiceIntent(tripId: string, audioBlob: Blob): Promise<VoiceIntentResponse> {
  const form = new FormData();
  form.append("trip_id", tripId);
  form.append("audio", new File([audioBlob], "audio.webm", { type: audioBlob.type }));
  const res = await fetch(`${BASE}/v1/voice/intent`, {
    method: "POST",
    body: form,
  });
  return json<VoiceIntentResponse>(res);
}

export async function downloadCalendar(tripId: string): Promise<Blob> {
  const res = await fetch(`${BASE}/v1/trips/${tripId}/calendar.ics`);
  if (!res.ok) throw new Error(`Calendar download failed: ${res.status}`);
  return res.blob();
}
