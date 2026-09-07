"use client";

import { getRoleLabel } from "@/lib/constants";

export interface StatsData {
  statuses: {
    key: string;
    label: string;
    count: number;
    color: string;
  }[];
  serviceBreakdown: Record<string, Record<string, number>> | null;
  SERVICE_COLORS: Record<string, string> | null;
  SERVICE_LABELS: Record<string, string> | null;
}

interface StatsCirclesProps {
  stats: StatsData;
  totalDocs: number;
  langue?: "fr" | "ar";
}

export function StatsCircles({ stats, totalDocs, langue = "fr" }: StatsCirclesProps) {
  const { statuses, serviceBreakdown, SERVICE_COLORS, SERVICE_LABELS } = stats;

  const circumference = 2 * Math.PI * 50;
  const radius = 50;
  const cx = 60;
  const cy = 60;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statuses.map((stat) => {
          const percentage = totalDocs > 0 ? (stat.count / totalDocs) * 100 : 0;
          const breakdown = serviceBreakdown?.[stat.key] || {};
          const hasBreakdown = serviceBreakdown && Object.keys(breakdown).length > 0;

          if (hasBreakdown && totalDocs > 0) {
            const segments = Object.entries(breakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([svc, count]) => ({
                svc,
                count,
                color: SERVICE_COLORS?.[svc] || "#64748b",
                pct: (count / totalDocs) * 100,
              }));

            let accumulated = 0;
            return (
              <div key={stat.key} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                    <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
                    {segments.map((seg) => {
                      const segLen = (seg.pct / 100) * circumference;
                      const offset = circumference - segLen - accumulated;
                      accumulated += segLen;
                      return (
                        <circle
                          key={seg.svc}
                          cx={cx} cy={cy} r={radius}
                          fill="none"
                          stroke={seg.color}
                          strokeWidth="10"
                          strokeDasharray={`${segLen} ${circumference - segLen}`}
                          strokeDashoffset={offset}
                          strokeLinecap="butt"
                          className="transition-all duration-700 ease-out"
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-extrabold text-slate-800">
                      {Math.round(percentage)}%
                    </span>
                  </div>
                </div>
                <span className="mt-3 text-xs font-bold text-slate-600 text-center">
                  {stat.label}
                </span>
                <span className="text-[10px] text-slate-400">
                  {stat.count}
                </span>
              </div>
            );
          }

          const offset = circumference - (percentage / 100) * circumference;
          return (
            <div key={stat.key} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
                  <circle
                    cx={cx} cy={cy} r={radius}
                    fill="none"
                    stroke={stat.color}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold text-slate-800">
                    {Math.round(percentage)}%
                  </span>
                </div>
              </div>
              <span className="mt-3 text-xs font-bold text-slate-600 text-center">
                {stat.label}
              </span>
              <span className="text-[10px] text-slate-400">
                {stat.count}
              </span>
            </div>
          );
        })}
      </div>

      {serviceBreakdown && SERVICE_COLORS && SERVICE_LABELS && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
            {totalDocs > 0 ? "" : ""}
          </p>
          <div className="flex flex-wrap gap-3">
            {(() => {
              const allServices: Record<string, number> = {};
              statuses.forEach((s) => {
                const bd = serviceBreakdown[s.key] || {};
                Object.entries(bd).forEach(([svc, count]) => {
                  allServices[svc] = (allServices[svc] || 0) + count;
                });
              });
              return Object.entries(allServices)
                .sort((a, b) => b[1] - a[1])
                .map(([svc, count]) => (
                  <div key={svc} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: SERVICE_COLORS[svc] || "#64748b" }}
                    />
                    <span className="text-slate-600 font-semibold">
                      {SERVICE_LABELS[svc] || getRoleLabel(svc, langue) || svc}
                    </span>
                    <span className="text-slate-400">
                      ({count})
                    </span>
                  </div>
                ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
