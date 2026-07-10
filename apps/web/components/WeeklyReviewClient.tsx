"use client";

import { RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { WeeklyReview } from "@personal-os/core";

export function WeeklyReviewClient() {
  const [review, setReview] = useState<WeeklyReview | null>(null);

  async function generate() {
    const response = await fetch("/api/reviews/weekly", { method: "POST" });
    const body = (await response.json()) as { review: WeeklyReview };
    setReview(body.review);
  }

  useEffect(() => {
    void generate();
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted">Weekly review</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">What changed this week?</h1>
          </div>
          <button onClick={generate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
            <RefreshCcw size={16} />
            Regenerate
          </button>
        </div>
      </section>
      {review ? (
        <div className="space-y-4">
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="text-sm text-muted">{review.weekStart} to {review.weekEnd}</div>
            <div className="mt-2 text-lg font-medium leading-7">{review.summary}</div>
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            <ReviewSection title="Work" items={review.work} />
            <ReviewSection title="Finance" items={review.finance} />
            <ReviewSection title="Health" items={review.health} />
            <ReviewSection title="Reading" items={review.reading} />
            <ReviewSection title="Planning" items={review.planning} />
            <ReviewSection title="Next week focus" items={review.nextWeekFocus} highlight />
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ReviewSection({ title, items, highlight = false }: { title: string; items: string[]; highlight?: boolean }) {
  return (
    <article className="rounded-lg border bg-card p-4 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-2 text-sm text-muted">
        {items.map((item) => <div key={item} className={highlight ? "rounded-lg border border-accent/40 bg-background px-3 py-2" : "rounded-lg border bg-background px-3 py-2"}>{item}</div>)}
      </div>
    </article>
  );
}
