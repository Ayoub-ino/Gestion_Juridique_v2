// app/components/dashboard/ActivityCards.tsx

"use client";

import type { TranslationKeys } from "@/lib/translations";

import { VueActive } from "@/app/types";

interface ActivityCard {
  title: string;
  value: number;
  view: VueActive;
  accent: string;
}

interface ActivityCardsProps {
  cards: ActivityCard[];
  onCardClick: (view: VueActive) => void;
  cur: TranslationKeys;
}

export function ActivityCards({ cards, onCardClick, cur }: ActivityCardsProps) {
  return (
    <div className="flex flex-col gap-3">
      {cards.map((card) => (
        <button
          key={card.title}
          type="button"
          onClick={() => onCardClick(card.view)}
          className="group bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition flex items-center justify-between"
        >
          <span className="text-xs font-bold text-slate-700">{card.title}</span>
          <div className="flex items-center gap-3">
            <span
              className={`min-w-7 h-6 px-2 rounded-full ${card.accent} text-white text-[11px] font-bold flex items-center justify-center`}
            >
              {card.value}
            </span>
            <span className="text-[11px] font-bold text-blue-700 group-hover:text-blue-900">{cur.ouvrir}</span>
          </div>
        </button>
      ))}
    </div>
  );
}