import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildReadingAnalytics,
  readingBookId,
  readingLogId,
  type ManualRecord,
  type ReadingBook,
  type ReadingLog,
  type StoredData,
} from "@personal-os/core";
import { readStore, writeStore } from "@/lib/server/local-store";

const bookPatchSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["want_to_read", "reading", "finished", "paused"]).optional(),
  totalPages: z.number().min(0).optional(),
  currentPage: z.number().min(0).optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  finishedDate: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  notes: z.string().optional(),
  keyLessons: z.string().optional(),
});

const logPatchSchema = z.object({
  bookId: z.string().optional(),
  date: z.string().min(4).optional(),
  pagesRead: z.number().min(0).optional(),
  minutesRead: z.number().min(0).optional(),
  fromPage: z.number().min(0).optional(),
  toPage: z.number().min(0).optional(),
  note: z.string().optional(),
  highlight: z.string().optional(),
  actionItem: z.string().optional(),
});

const postSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("book"),
    book: bookPatchSchema.extend({
      title: z.string().min(1),
      totalPages: z.number().min(0),
    }),
  }),
  z.object({
    type: z.literal("log"),
    log: logPatchSchema.extend({
      date: z.string().min(4),
      pagesRead: z.number().min(0),
      minutesRead: z.number().min(0),
    }),
  }),
]);

const patchSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("book"),
    id: z.string().min(1),
    patch: bookPatchSchema,
  }),
  z.object({
    type: z.literal("log"),
    id: z.string().min(1),
    patch: logPatchSchema,
  }),
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const store = await readStore();
  return readingResponse(store, date);
}

export async function POST(request: Request) {
  const payload = postSchema.parse(await request.json());
  const store = await readStore();
  const now = new Date().toISOString();

  if (payload.type === "book") {
    const book = createBook(payload.book, now);
    const nextStore = {
      ...store,
      readingBooks: [book, ...store.readingBooks],
    };
    await writeStore(nextStore);
    return readingResponse(nextStore, new Date().toISOString().slice(0, 10), 201);
  }

  const log = createLog(payload.log, now);
  const withLog = {
    ...store,
    readingBooks: applyLogToBooks(store.readingBooks, log, now),
    readingLogs: [log, ...store.readingLogs],
  };
  const nextStore = syncReadingManualSummary(withLog, log.date.slice(0, 10), now);
  await writeStore(nextStore);
  return readingResponse(nextStore, log.date.slice(0, 10), 201);
}

export async function PATCH(request: Request) {
  const payload = patchSchema.parse(await request.json());
  const store = await readStore();
  const now = new Date().toISOString();

  if (payload.type === "book") {
    const nextBooks = store.readingBooks.map((book) => (book.id === payload.id ? patchBook(book, payload.patch, now) : book));
    const nextStore = { ...store, readingBooks: nextBooks };
    await writeStore(nextStore);
    return readingResponse(nextStore, new Date().toISOString().slice(0, 10));
  }

  let changedDate = new Date().toISOString().slice(0, 10);
  const nextLogs = store.readingLogs.map((log) => {
    if (log.id !== payload.id) return log;
    const patched = patchLog(log, payload.patch, now);
    changedDate = patched.date.slice(0, 10);
    return patched;
  });
  const nextStore = syncReadingManualSummary({ ...store, readingLogs: nextLogs }, changedDate, now);
  await writeStore(nextStore);
  return readingResponse(nextStore, changedDate);
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");
  if (!id || !type) return NextResponse.json({ message: "Missing type or id" }, { status: 400 });

  const store = await readStore();
  const now = new Date().toISOString();

  if (type === "book") {
    const nextStore = {
      ...store,
      readingBooks: store.readingBooks.filter((book) => book.id !== id),
      readingLogs: store.readingLogs.filter((log) => log.bookId !== id),
    };
    await writeStore(nextStore);
    return readingResponse(nextStore, new Date().toISOString().slice(0, 10));
  }

  if (type === "log") {
    const deleted = store.readingLogs.find((log) => log.id === id);
    const date = deleted?.date.slice(0, 10) || new Date().toISOString().slice(0, 10);
    const nextStore = syncReadingManualSummary({ ...store, readingLogs: store.readingLogs.filter((log) => log.id !== id) }, date, now);
    await writeStore(nextStore);
    return readingResponse(nextStore, date);
  }

  return NextResponse.json({ message: "Unknown reading item type" }, { status: 400 });
}

function createBook(input: z.infer<typeof bookPatchSchema> & { title: string; totalPages: number }, now: string): ReadingBook {
  const totalPages = Math.max(0, Math.round(input.totalPages));
  const currentPage = Math.min(Math.max(0, Math.round(input.currentPage ?? 0)), totalPages || Number.MAX_SAFE_INTEGER);
  const book: ReadingBook = {
    id: readingBookId(),
    title: input.title.trim(),
    status: input.status ?? "reading",
    totalPages,
    currentPage,
    priority: input.priority ?? "medium",
    createdAt: now,
    updatedAt: now,
  };
  applyOptionalBookFields(book, input);
  return book;
}

function patchBook(book: ReadingBook, input: z.infer<typeof bookPatchSchema>, now: string): ReadingBook {
  const next: ReadingBook = { ...book, updatedAt: now };
  if (input.title !== undefined) next.title = input.title.trim();
  if (input.status !== undefined) next.status = input.status;
  if (input.totalPages !== undefined) next.totalPages = Math.max(0, Math.round(input.totalPages));
  if (input.currentPage !== undefined) next.currentPage = Math.max(0, Math.round(input.currentPage));
  if (input.priority !== undefined) next.priority = input.priority;
  next.currentPage = Math.min(next.currentPage, next.totalPages || Number.MAX_SAFE_INTEGER);
  applyOptionalBookFields(next, input);
  return next;
}

function applyOptionalBookFields(book: ReadingBook, input: z.infer<typeof bookPatchSchema>) {
  if (input.author !== undefined) book.author = input.author;
  if (input.category !== undefined) book.category = input.category;
  if (input.startDate !== undefined) book.startDate = input.startDate;
  if (input.targetDate !== undefined) book.targetDate = input.targetDate;
  if (input.finishedDate !== undefined) book.finishedDate = input.finishedDate;
  if (input.rating !== undefined) book.rating = input.rating;
  if (input.notes !== undefined) book.notes = input.notes;
  if (input.keyLessons !== undefined) book.keyLessons = input.keyLessons;
}

function createLog(input: z.infer<typeof logPatchSchema> & { date: string; pagesRead: number; minutesRead: number }, now: string): ReadingLog {
  const log: ReadingLog = {
    id: readingLogId(),
    date: input.date.slice(0, 10),
    pagesRead: Math.max(0, Math.round(input.pagesRead)),
    minutesRead: Math.max(0, Math.round(input.minutesRead)),
    source: "manual",
    createdAt: now,
    updatedAt: now,
  };
  applyOptionalLogFields(log, input);
  return log;
}

function patchLog(log: ReadingLog, input: z.infer<typeof logPatchSchema>, now: string): ReadingLog {
  const next: ReadingLog = { ...log, updatedAt: now };
  if (input.date !== undefined) next.date = input.date.slice(0, 10);
  if (input.pagesRead !== undefined) next.pagesRead = Math.max(0, Math.round(input.pagesRead));
  if (input.minutesRead !== undefined) next.minutesRead = Math.max(0, Math.round(input.minutesRead));
  applyOptionalLogFields(next, input);
  return next;
}

function applyOptionalLogFields(log: ReadingLog, input: z.infer<typeof logPatchSchema>) {
  if (input.bookId !== undefined) log.bookId = input.bookId;
  if (input.fromPage !== undefined) log.fromPage = Math.max(0, Math.round(input.fromPage));
  if (input.toPage !== undefined) log.toPage = Math.max(0, Math.round(input.toPage));
  if (input.note !== undefined) log.note = input.note;
  if (input.highlight !== undefined) log.highlight = input.highlight;
  if (input.actionItem !== undefined) log.actionItem = input.actionItem;
}

function applyLogToBooks(books: ReadingBook[], log: ReadingLog, now: string) {
  if (!log.bookId) return books;
  return books.map((book) => {
    if (book.id !== log.bookId) return book;
    const nextPage = Math.max(book.currentPage, log.toPage ?? book.currentPage + log.pagesRead);
    const next: ReadingBook = {
      ...book,
      currentPage: Math.min(nextPage, book.totalPages || Number.MAX_SAFE_INTEGER),
      status: book.status === "want_to_read" ? "reading" : book.status,
      updatedAt: now,
    };
    if (next.totalPages > 0 && next.currentPage >= next.totalPages) {
      next.status = "finished";
      next.finishedDate = log.date.slice(0, 10);
    }
    return next;
  });
}

function syncReadingManualSummary(store: StoredData, date: string, now: string): StoredData {
  const day = date.slice(0, 10);
  const summaryId = `reading:summary:${day}`;
  const logs = store.readingLogs.filter((log) => log.date.slice(0, 10) === day);
  const withoutSummary = store.manualRecords.filter((record) => record.id !== summaryId);
  if (logs.length === 0) return { ...store, manualRecords: withoutSummary };

  const pages = logs.reduce((sum, log) => sum + log.pagesRead, 0);
  const minutes = logs.reduce((sum, log) => sum + log.minutesRead, 0);
  const note = logs.find((log) => log.note?.trim() || log.highlight?.trim() || log.actionItem?.trim());
  const existing = store.manualRecords.find((record) => record.id === summaryId);
  const summary: ManualRecord = {
    id: summaryId,
    module: "reading",
    date: day,
    title: `Reading ${pages} pages`,
    amount: pages,
    unit: "pages",
    category: "Daily reading",
    status: "logged",
    metadata: {
      source: "reading-tracker",
      minutes,
      logCount: logs.length,
    },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const noteText = note?.note || note?.highlight || note?.actionItem;
  if (noteText) summary.notes = noteText;
  return { ...store, manualRecords: [summary, ...withoutSummary] };
}

function readingResponse(store: StoredData, date: string, status = 200) {
  const books = [...store.readingBooks].sort((a, b) => a.title.localeCompare(b.title));
  const logs = [...store.readingLogs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json(
    {
      books,
      logs,
      analytics: buildReadingAnalytics(books, logs, date.slice(0, 10)),
    },
    { status },
  );
}
