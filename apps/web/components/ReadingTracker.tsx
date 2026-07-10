"use client";

import {
  BarChart3,
  BookOpen,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  Highlighter,
  Library,
  ListPlus,
  NotebookPen,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReadingAnalytics, ReadingBook, ReadingBookPriority, ReadingBookStatus, ReadingLog } from "@personal-os/core";
import { cn, todayIso } from "@/lib/utils";

type ReadingApiResponse = {
  books: ReadingBook[];
  logs: ReadingLog[];
  analytics: ReadingAnalytics;
};

type BookFormState = {
  id?: string;
  title: string;
  author: string;
  category: string;
  status: ReadingBookStatus;
  totalPages: string;
  currentPage: string;
  startDate: string;
  targetDate: string;
  finishedDate: string;
  rating: string;
  priority: ReadingBookPriority;
  notes: string;
  keyLessons: string;
};

type LogFormState = {
  bookId: string;
  date: string;
  pagesRead: string;
  minutesRead: string;
  fromPage: string;
  toPage: string;
  note: string;
  highlight: string;
  actionItem: string;
};

const panelClass = "rounded-lg border border-border/70 bg-card p-5 shadow-soft";
const mutedPanelClass = "rounded-lg border border-border/70 bg-surface p-4";
const primaryButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/25";
const secondaryButtonClass = "inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-xs font-semibold shadow-sm transition hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-45";
const inputClass = "h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10";
const textAreaClass = "min-h-[92px] w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10";

const emptyBookForm: BookFormState = {
  title: "",
  author: "",
  category: "Personal growth",
  status: "reading",
  totalPages: "",
  currentPage: "0",
  startDate: todayIso(),
  targetDate: "",
  finishedDate: "",
  rating: "",
  priority: "medium",
  notes: "",
  keyLessons: "",
};

const chartColors = {
  accent: "#0f8f84",
  success: "#17915a",
  warning: "#d97706",
  muted: "#64748b",
  ink: "#0f172a",
};

export function ReadingTracker() {
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [data, setData] = useState<ReadingApiResponse | null>(null);
  const [status, setStatus] = useState("Loading reading tracker.");
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [bookForm, setBookForm] = useState<BookFormState>(emptyBookForm);
  const [logForm, setLogForm] = useState<LogFormState>(() => emptyLogForm(selectedDate));

  async function load(date = selectedDate) {
    const response = await fetch(`/api/reading?date=${date}`, { cache: "no-store" });
    if (!response.ok) {
      setStatus("Could not load reading tracker.");
      return;
    }
    const body = (await response.json()) as ReadingApiResponse;
    setData(body);
    setStatus("Ready.");
  }

  useEffect(() => {
    void load(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    setLogForm((current) => ({ ...current, date: selectedDate }));
  }, [selectedDate]);

  useEffect(() => {
    if (!data || logForm.bookId || data.analytics.books.length === 0) return;
    const firstActive = data.analytics.books.find((book) => book.status === "reading") ?? data.analytics.books[0];
    if (!firstActive) return;
    setLogForm((current) => ({
      ...current,
      bookId: firstActive.id,
      fromPage: firstActive.currentPage ? String(firstActive.currentPage + 1) : "",
    }));
  }, [data, logForm.bookId]);

  const analytics = data?.analytics;
  const books = analytics?.books ?? [];
  const activeBooks = books.filter((book) => book.status === "reading");
  const backlogBooks = books.filter((book) => book.status === "want_to_read");
  const selectedBook = books.find((book) => book.id === logForm.bookId);
  const readingFocus = activeBooks[0] ?? backlogBooks[0];
  const categoryData = useMemo(() => (analytics?.categoryStats ?? []).slice(0, 8), [analytics]);

  async function submitLog(event: React.FormEvent) {
    event.preventDefault();
    const pagesRead = parseNumber(logForm.pagesRead);
    if (pagesRead <= 0) {
      setStatus("Add pages read before saving.");
      return;
    }
    const payload = {
      type: "log",
      log: {
        bookId: logForm.bookId || undefined,
        date: logForm.date,
        pagesRead,
        minutesRead: parseNumber(logForm.minutesRead),
        fromPage: optionalNumber(logForm.fromPage),
        toPage: optionalNumber(logForm.toPage),
        note: logForm.note.trim() || undefined,
        highlight: logForm.highlight.trim() || undefined,
        actionItem: logForm.actionItem.trim() || undefined,
      },
    };
    const response = await fetch("/api/reading", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setStatus("Could not save reading log.");
      return;
    }
    const body = (await response.json()) as ReadingApiResponse;
    setData(body);
    setStatus("Reading session saved.");
    const nextBook = body.analytics.books.find((book) => book.id === logForm.bookId);
    setLogForm({
      ...emptyLogForm(selectedDate),
      bookId: logForm.bookId,
      fromPage: nextBook?.currentPage ? String(nextBook.currentPage + 1) : "",
    });
  }

  function openAddBook() {
    setBookForm(emptyBookForm);
    setBookModalOpen(true);
  }

  function openEditBook(book: ReadingBook) {
    setBookForm({
      id: book.id,
      title: book.title,
      author: book.author ?? "",
      category: book.category ?? "",
      status: book.status,
      totalPages: String(book.totalPages || ""),
      currentPage: String(book.currentPage || 0),
      startDate: book.startDate?.slice(0, 10) ?? "",
      targetDate: book.targetDate?.slice(0, 10) ?? "",
      finishedDate: book.finishedDate?.slice(0, 10) ?? "",
      rating: book.rating !== undefined ? String(book.rating) : "",
      priority: book.priority,
      notes: book.notes ?? "",
      keyLessons: book.keyLessons ?? "",
    });
    setBookModalOpen(true);
  }

  async function saveBook(event: React.FormEvent) {
    event.preventDefault();
    const bookPayload = {
      title: bookForm.title.trim(),
      author: bookForm.author.trim() || undefined,
      category: bookForm.category.trim() || undefined,
      status: bookForm.status,
      totalPages: parseNumber(bookForm.totalPages),
      currentPage: parseNumber(bookForm.currentPage),
      startDate: bookForm.startDate || undefined,
      targetDate: bookForm.targetDate || undefined,
      finishedDate: bookForm.finishedDate || undefined,
      rating: optionalNumber(bookForm.rating),
      priority: bookForm.priority,
      notes: bookForm.notes.trim() || undefined,
      keyLessons: bookForm.keyLessons.trim() || undefined,
    };
    const response = await fetch("/api/reading", {
      method: bookForm.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(bookForm.id ? { type: "book", id: bookForm.id, patch: bookPayload } : { type: "book", book: bookPayload }),
    });
    if (!response.ok) {
      setStatus("Could not save book.");
      return;
    }
    const body = (await response.json()) as ReadingApiResponse;
    setData(body);
    setStatus(bookForm.id ? "Book updated." : "Book added.");
    setBookModalOpen(false);
  }

  async function deleteBook() {
    if (!bookForm.id) return;
    const response = await fetch(`/api/reading?type=book&id=${encodeURIComponent(bookForm.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setStatus("Could not delete book.");
      return;
    }
    const body = (await response.json()) as ReadingApiResponse;
    setData(body);
    setStatus("Book deleted.");
    setBookModalOpen(false);
    if (logForm.bookId === bookForm.id) setLogForm(emptyLogForm(selectedDate));
  }

  function startLogForBook(book: ReadingBook) {
    setLogForm((current) => ({
      ...current,
      bookId: book.id,
      fromPage: book.currentPage ? String(book.currentPage + 1) : "",
      toPage: "",
    }));
    setStatus(`Ready to log ${book.title}.`);
  }

  return (
    <div className="space-y-5">
      <section className={cn(panelClass, "overflow-hidden border-accent/20 bg-[linear-gradient(135deg,rgba(15,143,132,0.10),rgba(255,255,255,0)_42%),linear-gradient(180deg,rgba(15,23,42,0.03),rgba(255,255,255,0))]")}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px] xl:items-stretch">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              <BookOpen size={14} />
              Reading command center
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-normal sm:text-4xl">Read consistently, finish books, capture useful ideas.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Keep active books visible, log pages in seconds, and turn highlights into action items instead of collecting unread notes.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className={primaryButtonClass} onClick={openAddBook}>
                <Plus size={16} />
                Add book
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => void load(selectedDate)}>
                Refresh
              </button>
            </div>
          </div>
          <div className="rounded-lg border bg-card/80 p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Today&apos;s focus</div>
            <div className="mt-3 text-xl font-semibold">{readingFocus ? readingFocus.title : "Add your first active book"}</div>
            <p className="mt-2 text-sm leading-6 text-muted">
              {readingFocus ? readingFocus.nextAction : "Once a book is added, this panel will show the next practical reading action."}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <StatusChip label="Target" value={`${analytics?.dailyTarget ?? 10} pages`} />
              <StatusChip label="Today" value={`${analytics?.todayPages ?? 0} pages`} />
              <StatusChip label="Streak" value={`${analytics?.currentStreak ?? 0} days`} />
            </div>
            <div className="mt-4 text-sm text-muted">{status}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Metric icon={<BookOpen size={18} />} label="Active books" value={`${analytics?.activeBooks ?? 0}`} />
        <Metric icon={<CheckCircle2 size={18} />} label="Today pages" value={`${analytics?.todayPages ?? 0}`} tone={(analytics?.todayPages ?? 0) >= (analytics?.dailyTarget ?? 10) ? "success" : "warning"} />
        <Metric icon={<Flame size={18} />} label="Reading streak" value={`${analytics?.currentStreak ?? 0}d`} tone={(analytics?.currentStreak ?? 0) > 0 ? "success" : "warning"} />
        <Metric icon={<CalendarDays size={18} />} label="Last 7 days" value={`${analytics?.weekPages ?? 0}p`} />
        <Metric icon={<Library size={18} />} label="Backlog" value={`${analytics?.backlogBooks ?? 0}`} />
        <Metric icon={<Highlighter size={18} />} label="Notes captured" value={`${analytics?.notesCaptured ?? 0}`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <form onSubmit={submitLog} className={panelClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Log today</div>
              <h2 className="mt-1 text-2xl font-semibold">Reading session</h2>
              <p className="mt-1 text-sm leading-6 text-muted">Log pages, time, one useful note, and an action item if the book gave you one.</p>
            </div>
            <input className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:border-accent" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Book">
              <select className={inputClass} value={logForm.bookId} onChange={(event) => setLogForm((current) => ({ ...current, bookId: event.target.value }))}>
                <option value="">Unassigned reading</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Minutes">
              <input className={inputClass} inputMode="numeric" value={logForm.minutesRead} onChange={(event) => setLogForm((current) => ({ ...current, minutesRead: event.target.value }))} placeholder="20" />
            </Field>
            <Field label="Pages read">
              <input className={inputClass} inputMode="numeric" value={logForm.pagesRead} onChange={(event) => setLogForm((current) => ({ ...current, pagesRead: event.target.value }))} placeholder="10" required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <input className={inputClass} inputMode="numeric" value={logForm.fromPage} onChange={(event) => setLogForm((current) => ({ ...current, fromPage: event.target.value }))} placeholder="121" />
              </Field>
              <Field label="To">
                <input className={inputClass} inputMode="numeric" value={logForm.toPage} onChange={(event) => setLogForm((current) => ({ ...current, toPage: event.target.value }))} placeholder="135" />
              </Field>
            </div>
          </div>

          {selectedBook ? (
            <div className="mt-4 rounded-lg border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{selectedBook.title}</div>
                  <div className="mt-1 text-xs text-muted">
                    {selectedBook.currentPage}/{selectedBook.totalPages || "?"} pages · {selectedBook.progressPercent}% complete
                  </div>
                </div>
                <div className="rounded-lg border bg-card px-3 py-2 text-xs font-semibold text-muted">{selectedBook.pagesLeft} pages left</div>
              </div>
              <ProgressBar value={selectedBook.progressPercent} />
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Field label="Note">
              <textarea className={textAreaClass} value={logForm.note} onChange={(event) => setLogForm((current) => ({ ...current, note: event.target.value }))} placeholder="Main idea in your own words" />
            </Field>
            <Field label="Highlight">
              <textarea className={textAreaClass} value={logForm.highlight} onChange={(event) => setLogForm((current) => ({ ...current, highlight: event.target.value }))} placeholder="Quote, framework, or key lesson" />
            </Field>
            <Field label="Action item">
              <textarea className={textAreaClass} value={logForm.actionItem} onChange={(event) => setLogForm((current) => ({ ...current, actionItem: event.target.value }))} placeholder="What should change because of this?" />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted">
              {analytics?.todayPages ?? 0}/{analytics?.dailyTarget ?? 10} pages done today
            </div>
            <button className={primaryButtonClass}>
              <ListPlus size={16} />
              Save reading log
            </button>
          </div>
        </form>

        <section className={panelClass}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Insights</div>
              <h2 className="mt-1 text-2xl font-semibold">What needs attention</h2>
            </div>
            <div className="rounded-lg border bg-surface px-3 py-2 text-sm font-semibold text-muted">{analytics?.bestStreak ?? 0}d best streak</div>
          </div>
          <div className="mt-4 space-y-3">
            {(analytics?.insights ?? []).map((insight) => (
              <div key={insight} className="rounded-lg border bg-surface px-4 py-3 text-sm leading-6 text-muted">
                {insight}
              </div>
            ))}
            {(analytics?.insights.length ?? 0) === 0 ? <div className="rounded-lg border bg-surface px-4 py-8 text-center text-sm text-muted">Add a book or log a session to get reading insights.</div> : null}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatusChip label="Month pages" value={`${analytics?.monthPages ?? 0}`} />
            <StatusChip label="Finished" value={`${analytics?.finishedBooks ?? 0}`} />
            <StatusChip label="Actions" value={`${analytics?.actionItemsCaptured ?? 0}`} />
          </div>
        </section>
      </section>

      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Books</div>
            <h2 className="mt-1 text-2xl font-semibold">Current shelf</h2>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={openAddBook}>
            <Plus size={15} />
            Add book
          </button>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {books.map((book) => (
            <BookCard key={book.id} book={book} onLog={() => startLogForBook(book)} onEdit={() => openEditBook(book)} />
          ))}
          {books.length === 0 ? (
            <div className="xl:col-span-3 rounded-lg border border-dashed bg-surface px-4 py-12 text-center">
              <BookOpen className="mx-auto text-accent" size={28} />
              <div className="mt-3 text-lg font-semibold">No books added yet</div>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">Add the book you are currently reading. The tracker will calculate pace, progress, streaks, and next action from your logs.</p>
              <button type="button" className={cn(primaryButtonClass, "mt-4")} onClick={openAddBook}>
                <Plus size={16} />
                Add first book
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className={panelClass}>
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-accent" />
            <h2 className="text-xl font-semibold">30-day reading rhythm</h2>
          </div>
          <div className="mt-4 h-[280px] min-w-0">
            {(analytics?.totalPagesLogged ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.dayStats ?? []} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColors.muted }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 11, fill: chartColors.muted }} tickLine={false} axisLine={false} width={34} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#d9e2ec" }} />
                  <Bar dataKey="pages" fill={chartColors.accent} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptySmall text="Log one reading session to start the 30-day rhythm chart." />
            )}
          </div>
        </section>

        <section className={panelClass}>
          <div className="flex items-center gap-2">
            <Target size={18} className="text-success" />
            <h2 className="text-xl font-semibold">Pages and notes</h2>
          </div>
          <div className="mt-4 h-[280px] min-w-0">
            {(analytics?.totalPagesLogged ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics?.dayStats ?? []} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartColors.muted }} tickLine={false} axisLine={false} interval={5} />
                  <YAxis tick={{ fontSize: 11, fill: chartColors.muted }} tickLine={false} axisLine={false} width={34} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#d9e2ec" }} />
                  <Line type="monotone" dataKey="pages" stroke={chartColors.accent} strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="notes" stroke={chartColors.warning} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptySmall text="Pages and note trends will appear after your first reading log." />
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className={panelClass}>
          <div className="flex items-center gap-2">
            <Library size={18} className="text-accent" />
            <h2 className="text-xl font-semibold">Category spread</h2>
          </div>
          <div className="mt-4 h-[300px] min-w-0">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 24 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: chartColors.muted }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: chartColors.muted }} tickLine={false} axisLine={false} width={92} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#d9e2ec" }} />
                  <Bar dataKey="pagesLogged" fill={chartColors.success} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptySmall text="Add books with categories to see spread." />
            )}
          </div>
        </section>

        <section className={panelClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <NotebookPen size={18} className="text-warning" />
              <h2 className="text-xl font-semibold">Recent logs and notes</h2>
            </div>
            <div className="rounded-lg border bg-surface px-3 py-1.5 text-xs font-semibold text-muted">{analytics?.recentLogs.length ?? 0} recent</div>
          </div>
          <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
            {(analytics?.recentLogs ?? []).map((log) => {
              const book = books.find((item) => item.id === log.bookId);
              return (
                <article key={log.id} className="rounded-lg border bg-surface px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{book?.title ?? "Unassigned reading"}</div>
                      <div className="mt-1 text-xs text-muted">{log.date.slice(0, 10)} · {log.pagesRead} pages · {log.minutesRead} min</div>
                    </div>
                    {log.toPage ? <div className="rounded-lg border bg-card px-2 py-1 text-xs font-semibold text-muted">to p.{log.toPage}</div> : null}
                  </div>
                  {log.note ? <p className="mt-3 text-sm leading-6 text-muted">{log.note}</p> : null}
                  {log.highlight ? <p className="mt-2 rounded-lg border bg-card px-3 py-2 text-sm leading-6 text-muted">{log.highlight}</p> : null}
                  {log.actionItem ? <p className="mt-2 text-sm font-semibold text-accent">Action: {log.actionItem}</p> : null}
                </article>
              );
            })}
            {(analytics?.recentLogs.length ?? 0) === 0 ? <EmptySmall text="No reading logs yet." /> : null}
          </div>
        </section>
      </section>

      {bookModalOpen ? (
        <BookModal
          form={bookForm}
          setForm={setBookForm}
          onClose={() => setBookModalOpen(false)}
          onSubmit={saveBook}
          onDelete={deleteBook}
        />
      ) : null}
    </div>
  );
}

function BookCard({ book, onLog, onEdit }: { book: ReadingAnalytics["books"][number]; onLog: () => void; onEdit: () => void }) {
  return (
    <article className="rounded-lg border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-lg border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]", statusClass(book.status))}>{statusLabel(book.status)}</span>
            <span className="rounded-lg border bg-card px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{book.priority}</span>
          </div>
          <h3 className="mt-3 line-clamp-2 text-lg font-semibold">{book.title}</h3>
          <div className="mt-1 text-sm text-muted">{book.author || book.category || "No author/category"}</div>
        </div>
        <button type="button" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-card shadow-sm transition hover:border-accent/50 hover:text-accent" onClick={onEdit} aria-label={`Edit ${book.title}`}>
          <Pencil size={15} />
        </button>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted">
          <span>{book.currentPage}/{book.totalPages || "?"} pages</span>
          <span>{book.progressPercent}%</span>
        </div>
        <ProgressBar value={book.progressPercent} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <StatusChip label="Left" value={`${book.pagesLeft}p`} />
        <StatusChip label="Pace" value={book.pagesPerDayNeeded ? `${book.pagesPerDayNeeded}p/d` : "No date"} />
        <StatusChip label="Last" value={book.lastReadDate ? book.lastReadDate.slice(5) : "Never"} />
      </div>

      <p className="mt-4 min-h-[44px] text-sm leading-6 text-muted">{book.nextAction}</p>
      <div className="mt-4 flex gap-2">
        <button type="button" className={cn(primaryButtonClass, "h-9 flex-1 px-3 text-xs")} onClick={onLog}>
          <NotebookPen size={14} />
          Log
        </button>
        <button type="button" className={cn(secondaryButtonClass, "flex-1")} onClick={onEdit}>
          Edit
        </button>
      </div>
    </article>
  );
}

function BookModal({
  form,
  setForm,
  onClose,
  onSubmit,
  onDelete,
}: {
  form: BookFormState;
  setForm: React.Dispatch<React.SetStateAction<BookFormState>>;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border bg-card p-5 shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">{form.id ? "Edit book" : "Add book"}</div>
            <h2 className="mt-1 text-2xl font-semibold">{form.id ? form.title || "Book" : "New reading item"}</h2>
          </div>
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-card shadow-sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Title">
            <input className={inputClass} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Book title" required />
          </Field>
          <Field label="Author">
            <input className={inputClass} value={form.author} onChange={(event) => setForm((current) => ({ ...current, author: event.target.value }))} placeholder="Author" />
          </Field>
          <Field label="Category">
            <input className={inputClass} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Business, personal growth, fiction" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select className={inputClass} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ReadingBookStatus }))}>
                <option value="reading">Reading</option>
                <option value="want_to_read">Want to read</option>
                <option value="paused">Paused</option>
                <option value="finished">Finished</option>
              </select>
            </Field>
            <Field label="Priority">
              <select className={inputClass} value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as ReadingBookPriority }))}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total pages">
              <input className={inputClass} inputMode="numeric" value={form.totalPages} onChange={(event) => setForm((current) => ({ ...current, totalPages: event.target.value }))} placeholder="300" required />
            </Field>
            <Field label="Current page">
              <input className={inputClass} inputMode="numeric" value={form.currentPage} onChange={(event) => setForm((current) => ({ ...current, currentPage: event.target.value }))} placeholder="0" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input className={inputClass} type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} />
            </Field>
            <Field label="Target date">
              <input className={inputClass} type="date" value={form.targetDate} onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Finished date">
              <input className={inputClass} type="date" value={form.finishedDate} onChange={(event) => setForm((current) => ({ ...current, finishedDate: event.target.value }))} />
            </Field>
            <Field label="Rating">
              <input className={inputClass} inputMode="decimal" value={form.rating} onChange={(event) => setForm((current) => ({ ...current, rating: event.target.value }))} placeholder="0-5" />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className={textAreaClass} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Why you are reading this, context, expectations" />
          </Field>
          <Field label="Key lessons">
            <textarea className={textAreaClass} value={form.keyLessons} onChange={(event) => setForm((current) => ({ ...current, keyLessons: event.target.value }))} placeholder="Final lessons or running summary" />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {form.id ? (
            <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 text-sm font-semibold text-danger transition hover:bg-danger/15" onClick={onDelete}>
              <Trash2 size={15} />
              Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" className={secondaryButtonClass} onClick={onClose}>
              Cancel
            </button>
            <button className={primaryButtonClass}>
              <Bookmark size={16} />
              Save book
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Metric({ icon, label, value, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; tone?: "neutral" | "success" | "warning" }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4 shadow-soft", tone === "success" && "border-success/25 bg-success/5", tone === "warning" && "border-warning/25 bg-warning/5")}>
      <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-surface text-accent", tone === "success" && "text-success", tone === "warning" && "text-warning")}>{icon}</div>
      <div className="mt-4 text-2xl font-semibold tracking-normal">{value}</div>
      <div className="mt-1 text-sm font-medium text-muted">{label}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function StatusChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-surface px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function EmptySmall({ text }: { text: string }) {
  return <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed bg-surface px-4 text-center text-sm text-muted">{text}</div>;
}

function emptyLogForm(date: string): LogFormState {
  return {
    bookId: "",
    date,
    pagesRead: "",
    minutesRead: "",
    fromPage: "",
    toPage: "",
    note: "",
    highlight: "",
    actionItem: "",
  };
}

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function statusLabel(status: ReadingBookStatus) {
  if (status === "want_to_read") return "Backlog";
  if (status === "reading") return "Reading";
  if (status === "finished") return "Finished";
  return "Paused";
}

function statusClass(status: ReadingBookStatus) {
  if (status === "reading") return "border-accent/25 bg-accent/10 text-accent";
  if (status === "finished") return "border-success/25 bg-success/10 text-success";
  if (status === "paused") return "border-warning/25 bg-warning/10 text-warning";
  return "border-border bg-card text-muted";
}
