import type { ISODateString, ReadingBook, ReadingLog } from "./types";
import { shiftISODate, toISODate } from "./habits";

export type ReadingBookWithStats = ReadingBook & {
  progressPercent: number;
  pagesLeft: number;
  pagesPerDayNeeded: number | null;
  lastLog?: ReadingLog;
  lastReadDate?: ISODateString;
  daysSinceRead: number | null;
  nextAction: string;
};

export type ReadingDayStat = {
  date: ISODateString;
  label: string;
  pages: number;
  minutes: number;
  notes: number;
};

export type ReadingCategoryStat = {
  category: string;
  books: number;
  pagesLogged: number;
};

export type ReadingAnalytics = {
  date: ISODateString;
  dailyTarget: number;
  activeBooks: number;
  backlogBooks: number;
  finishedBooks: number;
  todayPages: number;
  todayMinutes: number;
  weekPages: number;
  monthPages: number;
  totalPagesLogged: number;
  notesCaptured: number;
  highlightsCaptured: number;
  actionItemsCaptured: number;
  currentStreak: number;
  bestStreak: number;
  dayStats: ReadingDayStat[];
  categoryStats: ReadingCategoryStat[];
  books: ReadingBookWithStats[];
  recentLogs: ReadingLog[];
  insights: string[];
};

export const defaultReadingTarget = 10;

export function buildReadingAnalytics(books: ReadingBook[], logs: ReadingLog[], date = toISODate(new Date()), dailyTarget = defaultReadingTarget): ReadingAnalytics {
  const normalizedDate = date.slice(0, 10);
  const sortedBooks = [...books].sort(sortBooks);
  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const dayStats = buildDayStats(sortedLogs, normalizedDate, 30);
  const today = dayStats[dayStats.length - 1] ?? { date: normalizedDate, label: normalizedDate.slice(5), pages: 0, minutes: 0, notes: 0 };
  const weekPages = dayStats.slice(-7).reduce((sum, day) => sum + day.pages, 0);
  const monthPages = dayStats.reduce((sum, day) => sum + day.pages, 0);
  const completedDates = new Set(dayStats.filter((day) => day.pages > 0).map((day) => day.date));
  const booksWithStats = sortedBooks.map((book) => withBookStats(book, sortedLogs, normalizedDate, dailyTarget));
  const categoryStats = buildCategoryStats(booksWithStats, sortedLogs);

  return {
    date: normalizedDate,
    dailyTarget,
    activeBooks: booksWithStats.filter((book) => book.status === "reading").length,
    backlogBooks: booksWithStats.filter((book) => book.status === "want_to_read").length,
    finishedBooks: booksWithStats.filter((book) => book.status === "finished").length,
    todayPages: today.pages,
    todayMinutes: today.minutes,
    weekPages,
    monthPages,
    totalPagesLogged: sortedLogs.reduce((sum, log) => sum + log.pagesRead, 0),
    notesCaptured: sortedLogs.filter((log) => Boolean(log.note?.trim())).length,
    highlightsCaptured: sortedLogs.filter((log) => Boolean(log.highlight?.trim())).length,
    actionItemsCaptured: sortedLogs.filter((log) => Boolean(log.actionItem?.trim())).length,
    currentStreak: countCurrentStreak(completedDates, normalizedDate),
    bestStreak: countBestStreak(completedDates),
    dayStats,
    categoryStats,
    books: booksWithStats,
    recentLogs: sortedLogs.slice(0, 12),
    insights: buildInsights(booksWithStats, sortedLogs, today.pages, weekPages, dailyTarget, normalizedDate),
  };
}

export function readingLogId() {
  return `reading-log:${crypto.randomUUID()}`;
}

export function readingBookId() {
  return `reading-book:${crypto.randomUUID()}`;
}

function withBookStats(book: ReadingBook, logs: ReadingLog[], date: ISODateString, dailyTarget: number): ReadingBookWithStats {
  const bookLogs = logs.filter((log) => log.bookId === book.id);
  const lastLog = bookLogs[0];
  const currentPage = Math.min(Math.max(book.currentPage, 0), Math.max(book.totalPages, 0));
  const pagesLeft = Math.max(book.totalPages - currentPage, 0);
  const daysLeft = book.targetDate ? Math.max(daysBetween(date, book.targetDate.slice(0, 10)), 1) : null;
  const pagesPerDayNeeded = daysLeft ? Math.ceil(pagesLeft / daysLeft) : null;
  const lastReadDate = lastLog?.date.slice(0, 10);
  const result: ReadingBookWithStats = {
    ...book,
    currentPage,
    progressPercent: book.totalPages > 0 ? Math.min(100, Math.round((currentPage / book.totalPages) * 100)) : 0,
    pagesLeft,
    pagesPerDayNeeded,
    daysSinceRead: lastReadDate ? daysBetween(lastReadDate, date) : null,
    nextAction: buildBookAction(book, pagesLeft, pagesPerDayNeeded, dailyTarget, lastReadDate),
  };
  if (lastLog) result.lastLog = lastLog;
  if (lastReadDate) result.lastReadDate = lastReadDate;
  return result;
}

function buildDayStats(logs: ReadingLog[], date: ISODateString, days: number): ReadingDayStat[] {
  return Array.from({ length: days }, (_, index) => {
    const day = shiftISODate(date, index - days + 1);
    const dayLogs = logs.filter((log) => log.date.slice(0, 10) === day);
    return {
      date: day,
      label: day.slice(5),
      pages: dayLogs.reduce((sum, log) => sum + log.pagesRead, 0),
      minutes: dayLogs.reduce((sum, log) => sum + log.minutesRead, 0),
      notes: dayLogs.filter((log) => Boolean(log.note?.trim() || log.highlight?.trim() || log.actionItem?.trim())).length,
    };
  });
}

function buildCategoryStats(books: ReadingBookWithStats[], logs: ReadingLog[]): ReadingCategoryStat[] {
  const byBook = new Map(books.map((book) => [book.id, book]));
  const byCategory = new Map<string, ReadingCategoryStat>();
  for (const book of books) {
    const category = book.category?.trim() || "Uncategorized";
    const current = byCategory.get(category) ?? { category, books: 0, pagesLogged: 0 };
    current.books += 1;
    byCategory.set(category, current);
  }
  for (const log of logs) {
    const category = log.bookId ? (byBook.get(log.bookId)?.category?.trim() || "Uncategorized") : "Unassigned";
    const current = byCategory.get(category) ?? { category, books: 0, pagesLogged: 0 };
    current.pagesLogged += log.pagesRead;
    byCategory.set(category, current);
  }
  return [...byCategory.values()].sort((a, b) => b.pagesLogged - a.pagesLogged || b.books - a.books);
}

function buildBookAction(book: ReadingBook, pagesLeft: number, pagesPerDayNeeded: number | null, dailyTarget: number, lastReadDate?: ISODateString) {
  if (book.status === "finished") return "Finished. Capture final lessons and rating.";
  if (book.status === "paused") return "Paused. Resume only if it still supports a current goal.";
  if (book.status === "want_to_read") return "Backlog. Start it when one active book is completed.";
  if (pagesLeft <= 0) return "Mark finished and write the key lessons.";
  if (pagesPerDayNeeded && pagesPerDayNeeded > dailyTarget) return `Read ${pagesPerDayNeeded} pages/day to finish on target.`;
  if (!lastReadDate) return `Start with ${dailyTarget} pages and one note.`;
  return `Read ${Math.max(dailyTarget, pagesPerDayNeeded ?? dailyTarget)} pages next.`;
}

function buildInsights(books: ReadingBookWithStats[], logs: ReadingLog[], todayPages: number, weekPages: number, dailyTarget: number, date: ISODateString) {
  const insights: string[] = [];
  const active = books.filter((book) => book.status === "reading");
  const stale = active.filter((book) => (book.daysSinceRead ?? 99) >= 4);
  const urgent = active.filter((book) => book.pagesPerDayNeeded !== null && book.pagesPerDayNeeded > dailyTarget);
  const notesThisWeek = logs.filter((log) => daysBetween(log.date.slice(0, 10), date) <= 7 && Boolean(log.note?.trim() || log.highlight?.trim() || log.actionItem?.trim())).length;

  if (todayPages >= dailyTarget) {
    insights.push(`Daily target is closed: ${todayPages} page${todayPages === 1 ? "" : "s"} logged today.`);
  } else {
    insights.push(`Read ${dailyTarget - todayPages} more page${dailyTarget - todayPages === 1 ? "" : "s"} to close today.`);
  }
  if (active.length === 0) insights.push("No active book. Move one backlog book to Reading and log the first session.");
  if (active.length > 3) insights.push("Too many active books. Finish or pause one so attention stays focused.");
  if (stale[0]) insights.push(`${stale[0].title} has not been logged for ${stale[0].daysSinceRead} days. Resume it or pause it.`);
  if (urgent[0]) insights.push(`${urgent[0].title} needs ${urgent[0].pagesPerDayNeeded} pages/day to hit the target date.`);
  if (weekPages < dailyTarget * 4) insights.push(`Weekly volume is light at ${weekPages} pages. Aim for four useful reading days this week.`);
  if (notesThisWeek === 0 && logs.length > 0) insights.push("You are logging pages but not notes. Capture one highlight or action item today.");
  return insights.slice(0, 5);
}

function sortBooks(a: ReadingBook, b: ReadingBook) {
  const statusRank: Record<ReadingBook["status"], number> = {
    reading: 0,
    want_to_read: 1,
    paused: 2,
    finished: 3,
  };
  const priorityRank: Record<ReadingBook["priority"], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return statusRank[a.status] - statusRank[b.status] || priorityRank[a.priority] - priorityRank[b.priority] || a.title.localeCompare(b.title);
}

function countCurrentStreak(completedDates: Set<string>, date: ISODateString) {
  let streak = 0;
  let cursor = date;
  while (completedDates.has(cursor)) {
    streak += 1;
    cursor = shiftISODate(cursor, -1);
  }
  return streak;
}

function countBestStreak(completedDates: Set<string>) {
  const dates = [...completedDates].sort();
  let best = 0;
  let current = 0;
  let previous = "";
  for (const date of dates) {
    current = previous && shiftISODate(previous, 1) === date ? current + 1 : 1;
    best = Math.max(best, current);
    previous = date;
  }
  return best;
}

function daysBetween(start: ISODateString, end: ISODateString) {
  const startDate = new Date(`${start.slice(0, 10)}T00:00:00.000Z`);
  const endDate = new Date(`${end.slice(0, 10)}T00:00:00.000Z`);
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
}
