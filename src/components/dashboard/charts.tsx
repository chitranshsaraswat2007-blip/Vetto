import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const palette = ["#a84f38", "#d39c31", "#40665a", "#66768b", "#c77f60", "#89936b"];

export type ChartDatum = { label: string; value: number };

export function weekStartUtc(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - 6);
  return start;
}

export function weekSeries(records: Date[], now = new Date()): ChartDatum[] {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6 + index));
    return { date, key: date.toISOString().slice(0, 10), value: 0 };
  });
  const counts = new Map(days.map((day) => [day.key, day]));
  for (const record of records) {
    const key = record.toISOString().slice(0, 10);
    const day = counts.get(key);
    if (day) day.value += 1;
  }
  return days.map((day) => ({
    label: new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(day.date),
    value: day.value,
  }));
}

export function StatusDonut({
  title,
  description,
  data,
  centerLabel = "TOTAL",
}: {
  title: string;
  description: string;
  data: ChartDatum[];
  centerLabel?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const circumference = 2 * Math.PI * 38;
  let offset = 0;

  return (
    <Card className="dashboard-chart-card overflow-hidden">
      <CardHeader className="pb-2">
        <p className="dashboard-kicker">At a glance</p>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs leading-5 text-ink-muted">{description}</p>
      </CardHeader>
      <CardContent className="grid items-center gap-5 sm:grid-cols-[10rem_1fr]">
        <div className="relative mx-auto size-36">
          <svg viewBox="0 0 100 100" role="img" aria-label={`${total} total items`} className="size-full -rotate-90">
            <circle cx="50" cy="50" r="38" fill="none" stroke="#eee8dd" strokeWidth="15" />
            {total > 0 ? data.filter((item) => item.value > 0).map((item) => {
              const dash = (item.value / total) * circumference;
              const currentOffset = offset;
              offset += dash;
              return <circle key={item.label} cx="50" cy="50" r="38" fill="none" stroke={palette[data.indexOf(item) % palette.length]} strokeWidth="15" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-currentOffset} />;
            }) : null}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl leading-none text-ink">{total}</span>
            <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-muted">{centerLabel}</span>
          </div>
        </div>
        <ul className="grid gap-2">
          {data.map((item, index) => (
            <li key={item.label} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-ink-soft">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: palette[index % palette.length] }} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="font-semibold tabular-nums text-ink">{item.value}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function WeekBarChart({
  title,
  description,
  data,
  emptyLabel = "No activity recorded in the last seven days.",
}: {
  title: string;
  description: string;
  data: ChartDatum[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="dashboard-chart-card overflow-hidden">
      <CardHeader className="pb-2">
        <p className="dashboard-kicker">Last 7 days · {total} total</p>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs leading-5 text-ink-muted">{description}</p>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-line text-center text-xs text-ink-muted">{emptyLabel}</div>
        ) : (
          <div className="grid h-36 grid-cols-7 items-end gap-2 border-b border-line bg-[linear-gradient(to_bottom,transparent_32%,var(--line)_33%,transparent_34%,transparent_65%,var(--line)_66%,transparent_67%)] px-1">
            {data.map((item, index) => {
              const height = item.value === 0 ? 4 : Math.max(12, (item.value / max) * 100);
              return (
                <div key={`${item.label}-${index}`} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                  <span className="text-[10px] font-medium tabular-nums text-ink-muted">{item.value || ""}</span>
                  <div className="flex h-[78%] w-full items-end">
                    <div title={`${item.label}: ${item.value}`} className="w-full rounded-t-md bg-[linear-gradient(180deg,#d69b3c,#a84f38)] shadow-[0_5px_14px_rgba(168,79,56,0.18)] transition-[height,filter] duration-300 hover:brightness-110" style={{ height: `${height}%` }} />
                  </div>
                  <span className="text-[9px] uppercase tracking-wide text-ink-muted">{item.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
