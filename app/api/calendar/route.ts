import { NextRequest, NextResponse } from "next/server";
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

// Safety cap on recurrence expansion. The windowEnd break below is what
// actually terminates the loop; this only guards a runaway rule. It must be
// generous: the iterator starts at the event's original DTSTART, so a weekly
// event from two years ago needs ~100 steps just to reach today's window, and
// a daily one needs thousands. Too low a cap silently drops old recurring
// events before they ever enter the window.
const MAX_OCCURRENCES = 10000;

/** Show enough of a feed URL to identify it without printing the whole secret. */
function maskUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.length <= 40) return trimmed;
  return `${trimmed.slice(0, 32)}…${trimmed.slice(-6)}`;
}

async function fetchAndParse(url: string, calendar: "google" | "apple"): Promise<CalEvent[]> {
  // Apple hands out webcal:// links, which fetch() cannot resolve — the scheme
  // is just https with a "subscribe me" hint for the OS. Normalise it so a URL
  // pasted verbatim from Calendar.app works.
  const httpUrl = url.trim().replace(/^webcal:\/\//i, "https://");

  const res = await fetch(httpUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  if (!text.includes("BEGIN:VCALENDAR")) {
    throw new Error("Response was not an iCalendar feed");
  }

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
      // Detect BYSETPOS — ICAL.js generates all BYMONTHDAY/BYDAY candidates but
      // does NOT filter by BYSETPOS. We collect all occurrences then apply it ourselves.
      const rruleProp = vevent.getFirstPropertyValue("rrule") as ICAL.Recur | null;
      const bySetPos: number[] | undefined = rruleProp?.parts?.BYSETPOS;
      const freq: string = (rruleProp?.freq ?? "").toUpperCase();

      const iter = event.iterator();
      let next: ICAL.Time;
      let count = 0;

      if (bySetPos?.length) {
        // Gather all raw candidates within the window (collect more to cover full periods)
        type Occ = { time: ICAL.Time; periodKey: string };
        const candidates: Occ[] = [];

        while ((next = iter.next()) && count < MAX_OCCURRENCES) {
          count++;
          if (next.compare(windowEnd) > 0) break;
          // Group key: the recurrence period
          const js = next.toJSDate();
          let periodKey: string;
          if (freq === "MONTHLY") {
            periodKey = `${js.getUTCFullYear()}-${js.getUTCMonth()}`;
          } else if (freq === "YEARLY") {
            periodKey = `${js.getUTCFullYear()}`;
          } else {
            // WEEKLY/DAILY — period doesn't apply, treat each as own period
            periodKey = `${next.toUnixTime()}`;
          }
          candidates.push({ time: next.clone(), periodKey });
        }

        // Group by period, sort within each, apply BYSETPOS selection
        const byPeriod = new Map<string, ICAL.Time[]>();
        for (const { time, periodKey } of candidates) {
          if (!byPeriod.has(periodKey)) byPeriod.set(periodKey, []);
          byPeriod.get(periodKey)!.push(time);
        }

        for (const occs of byPeriod.values()) {
          occs.sort((a, b) => a.compare(b));
          for (const pos of bySetPos) {
            const idx = pos > 0 ? pos - 1 : occs.length + pos;
            if (idx < 0 || idx >= occs.length) continue;
            const occ = occs[idx];
            if (occ.compare(windowStart) < 0) continue;
            const dur = event.duration;
            const end = occ.clone();
            end.addDuration(dur);
            events.push({
              id: `${event.uid}-${occ.toUnixTime()}`,
              title: event.summary,
              start: occ.toJSDate().toISOString(),
              end: end.toJSDate().toISOString(),
              allDay: occ.isDate,
              calendar,
              location: event.location || undefined,
            });
          }
        }
      } else {
        // Normal iteration — no BYSETPOS
        while ((next = iter.next()) && count < MAX_OCCURRENCES) {
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
      }
    } else {
      const start = event.startDate;
      const end = event.endDate;
      if (!start) return;
      if (start.compare(windowEnd) > 0) return;
      if (end && end.compare(windowStart) < 0) return;
      events.push({
        // Always qualify with the start time: a feed can carry several VEVENTs
        // sharing one UID (recurrence overrides), and a bare UID collides as a
        // React key when it does.
        id: `${event.uid || calendar}-${start.toUnixTime()}`,
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

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ?debug=1 reports per-feed status. A feed that 404s or fails to parse
  // otherwise contributes zero events silently, which is indistinguishable
  // from an empty calendar — this makes the difference visible.
  const debug = req.nextUrl.searchParams.get("debug") === "1";

  // Return cache if fresh
  if (!debug && cache && Date.now() - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.events, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  // Each iCloud/Google share URL exposes exactly one calendar, so both vars
  // accept a comma-separated list — one URL per calendar you want included.
  const urlList = (value: string | undefined): string[] =>
    (value ?? "")
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);

  const feeds: { url: string; source: "google" | "apple" }[] = [
    ...urlList(process.env.GOOGLE_CALENDAR_ICAL_URL).map((url) => ({ url, source: "google" as const })),
    ...urlList(process.env.APPLE_CALENDAR_ICAL_URL).map((url) => ({ url, source: "apple" as const })),
  ];

  const diagnostics: { source: string; url: string; ok: boolean; events: number; error?: string }[] = [];

  const results = await Promise.all(
    feeds.map(({ url, source }) =>
      fetchAndParse(url, source)
        .then((evts) => {
          diagnostics.push({ source, url: maskUrl(url), ok: true, events: evts.length });
          return evts;
        })
        .catch((err) => {
          console.error(`[calendar] ${source} feed failed:`, url, err);
          diagnostics.push({
            source,
            url: maskUrl(url),
            ok: false,
            events: 0,
            error: err instanceof Error ? err.message : String(err),
          });
          return [] as CalEvent[];
        })
    )
  );

  // Dedupe by id — the same calendar listed twice, or a calendar subscribed to
  // from both accounts, would otherwise emit every event more than once.
  const seen = new Set<string>();
  const events = results
    .flat()
    .filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  cache = { events, at: Date.now() };

  if (debug) {
    return NextResponse.json(
      {
        configured: {
          google: urlList(process.env.GOOGLE_CALENDAR_ICAL_URL).length,
          apple: urlList(process.env.APPLE_CALENDAR_ICAL_URL).length,
        },
        feeds: diagnostics,
        totalEvents: events.length,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(events, {
    headers: { "Cache-Control": "no-store" },
  });
}
