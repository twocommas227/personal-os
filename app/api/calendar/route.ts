import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import ICAL from "ical.js";

export interface CalEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string;   // ISO
  allDay: boolean;
  calendar: "google" | "apple";
  location?: string;
}

// Module-level cache — 5 minute TTL
let cache: { events: CalEvent[]; at: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchAndParse(url: string, calendar: "google" | "apple"): Promise<CalEvent[]> {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  const jcal = ICAL.parse(text);
  const comp = new ICAL.Component(jcal);
  const events: CalEvent[] = [];

  const now = ICAL.Time.now();
  const windowStart = now.clone();
  windowStart.addDuration(new ICAL.Duration({ days: -1 }));
  const windowEnd = now.clone();
  windowEnd.addDuration(new ICAL.Duration({ days: 30 }));

  comp.getAllSubcomponents("vevent").forEach((vevent: ICAL.Component) => {
    const event = new ICAL.Event(vevent);

    if (event.isRecurring()) {
      const iter = event.iterator();
      let next: ICAL.Time;
      let count = 0;
      while ((next = iter.next()) && count < 60) {
        if (next.compare(windowEnd) > 0) break;
        if (next.compare(windowStart) >= 0) {
          const duration = event.duration;
          const end = next.clone();
          end.addDuration(duration);
          events.push({
            id: `${event.uid}-${next.toUnixTime()}`,
            title: event.summary,
            start: next.toJSDate().toISOString(),
            end: end.toJSDate().toISOString(),
            allDay: next.isDate,
            calendar,
            location: event.location || undefined,
          });
        }
        count++;
      }
    } else {
      const start = event.startDate;
      const end = event.endDate;
      if (!start) return;
      if (start.compare(windowEnd) > 0) return;
      if (end && end.compare(windowStart) < 0) return;
      events.push({
        id: event.uid || `${calendar}-${start.toUnixTime()}`,
        title: event.summary || "(No title)",
        start: start.toJSDate().toISOString(),
        end: (end ?? start).toJSDate().toISOString(),
        allDay: start.isDate,
        calendar,
        location: event.location || undefined,
      });
    }
  });

  return events;
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Return cache if fresh
  if (cache && Date.now() - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.events, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const googleUrl = process.env.GOOGLE_CALENDAR_ICAL_URL;
  const appleUrl = process.env.APPLE_CALENDAR_ICAL_URL;

  const fetches: Promise<CalEvent[]>[] = [];
  if (googleUrl) fetches.push(fetchAndParse(googleUrl, "google").catch(() => []));
  if (appleUrl) fetches.push(fetchAndParse(appleUrl, "apple").catch(() => []));

  const results = await Promise.all(fetches);
  const events = results
    .flat()
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  cache = { events, at: Date.now() };

  return NextResponse.json(events, {
    headers: { "Cache-Control": "no-store" },
  });
}
