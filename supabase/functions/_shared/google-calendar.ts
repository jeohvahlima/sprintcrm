// Utilidades para chamadas à Google Calendar API com refresh automático.

export async function refreshGoogleToken(refresh_token: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
  const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "Failed to refresh token");
  return data;
}

export async function getValidAccessToken(supabase: any, userId: string): Promise<{
  access_token: string;
  calendar_id: string;
  integration_id: string;
}> {
  const { data: integration, error } = await supabase
    .from("google_calendar_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (error || !integration) throw new Error("Google Calendar not connected for this user");

  const expiresAt = new Date(integration.token_expires_at).getTime();
  // Refresh se faltar < 60s
  if (expiresAt - Date.now() < 60_000) {
    const refreshed = await refreshGoogleToken(integration.refresh_token);
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabase
      .from("google_calendar_integrations")
      .update({
        access_token: refreshed.access_token,
        token_expires_at: newExpiresAt,
      })
      .eq("id", integration.id);
    return {
      access_token: refreshed.access_token,
      calendar_id: integration.calendar_id,
      integration_id: integration.id,
    };
  }

  return {
    access_token: integration.access_token,
    calendar_id: integration.calendar_id,
    integration_id: integration.id,
  };
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  start: string; // ISO
  end: string;   // ISO
  attendeeEmails?: string[];
  reminders?: { popup?: number[]; email?: number[] }; // minutos antes
  location?: string;
  timeZone?: string;
}

export function buildEventBody(input: CalendarEventInput): any {
  const overrides: { method: string; minutes: number }[] = [];
  (input.reminders?.popup ?? []).forEach(m => overrides.push({ method: "popup", minutes: m }));
  (input.reminders?.email ?? []).forEach(m => overrides.push({ method: "email", minutes: m }));

  return {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: input.start, timeZone: input.timeZone || "America/Sao_Paulo" },
    end: { dateTime: input.end, timeZone: input.timeZone || "America/Sao_Paulo" },
    attendees: (input.attendeeEmails || []).map(email => ({ email })),
    reminders: overrides.length > 0
      ? { useDefault: false, overrides }
      : { useDefault: true },
  };
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  body: any,
  sendUpdates: "all" | "externalOnly" | "none" = "all"
) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=${sendUpdates}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Calendar error: ${JSON.stringify(data)}`);
  return data;
}

export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  body: any,
  sendUpdates: "all" | "externalOnly" | "none" = "all"
) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}?sendUpdates=${sendUpdates}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Calendar update error: ${JSON.stringify(data)}`);
  return data;
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  sendUpdates: "all" | "externalOnly" | "none" = "all"
) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}?sendUpdates=${sendUpdates}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Google Calendar delete error: ${JSON.stringify(data)}`);
  }
  return true;
}

export async function listCalendarEvents(
  accessToken: string,
  calendarId: string,
  params: { timeMin?: string; timeMax?: string; syncToken?: string; pageToken?: string } = {}
) {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");
  if (params.timeMin) url.searchParams.set("timeMin", params.timeMin);
  if (params.timeMax) url.searchParams.set("timeMax", params.timeMax);
  if (params.syncToken) {
    url.searchParams.delete("orderBy");
    url.searchParams.delete("timeMin");
    url.searchParams.delete("timeMax");
    url.searchParams.set("syncToken", params.syncToken);
  }
  if (params.pageToken) url.searchParams.set("pageToken", params.pageToken);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google Calendar list error: ${JSON.stringify(data)}`);
  return data;
}
