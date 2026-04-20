import { useState, useCallback, useMemo, useEffect, useRef, Fragment } from "react";
import { Settings, Plus, X, Trash2, Edit3, Calendar, LayoutGrid, ArrowLeft, Check, ChevronRight, Loader2, Inbox, Send } from "lucide-react";

/* ═══════════════════════════════════════════════════
   Supabase REST Client (kein SDK nötig)
   ═══════════════════════════════════════════════════ */
const SB = {
  url: "https://reiiptqextmddmkacnlr.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaWlwdHFleHRtZGRta2FjbmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NDgzMTksImV4cCI6MjA5MTUyNDMxOX0.dlxOgAgMAwegMZVVkXliyMKuvTc8GDk5UIccwx62YDw",
  _h() { return { apikey: this.key, Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", Prefer: "return=representation" }; },
  async select(table, query = "") {
    const r = await fetch(`${this.url}/rest/v1/${table}?${query}`, { headers: this._h() });
    return r.ok ? r.json() : [];
  },
  async insert(table, row) {
    const r = await fetch(`${this.url}/rest/v1/${table}`, { method: "POST", headers: this._h(), body: JSON.stringify(row) });
    return r.ok ? (await r.json())[0] : null;
  },
  async update(table, id, patch) {
    const r = await fetch(`${this.url}/rest/v1/${table}?id=eq.${id}`, { method: "PATCH", headers: this._h(), body: JSON.stringify(patch) });
    return r.ok;
  },
  async upsert(table, row, onConflict) {
    const h = { ...this._h(), Prefer: "return=representation,resolution=merge-duplicates" };
    const r = await fetch(`${this.url}/rest/v1/${table}?on_conflict=${onConflict}`, { method: "POST", headers: h, body: JSON.stringify(row) });
    return r.ok ? (await r.json())[0] : null;
  },
  async delete(table, id) {
    const r = await fetch(`${this.url}/rest/v1/${table}?id=eq.${id}`, { method: "DELETE", headers: this._h() });
    return r.ok;
  },
  async deleteWhere(table, query) {
    const r = await fetch(`${this.url}/rest/v1/${table}?${query}`, { method: "DELETE", headers: this._h() });
    return r.ok;
  },
};

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */
let _id = Date.now();
const uid = () => String(++_id);

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - y1) / 864e5 + 1) / 7);
}

function buildTimeline(monthCount = 6) {
  const now = new Date();
  const months = [];
  const usedWeeks = new Set();
  for (let m = 0; m < monthCount; m++) {
    const yr = now.getFullYear() + Math.floor((now.getMonth() + m) / 12);
    const mo = (now.getMonth() + m) % 12;
    const label = new Date(yr, mo, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    const dim = new Date(yr, mo + 1, 0).getDate();
    const weeks = [];
    for (let d = 1; d <= dim; d++) {
      const date = new Date(yr, mo, d);
      const thu = new Date(date);
      const dow = thu.getDay() || 7;
      thu.setDate(thu.getDate() + (4 - dow));
      if (thu.getMonth() !== mo || thu.getFullYear() !== yr) continue;
      const w = isoWeek(date);
      const wy = thu.getFullYear();
      const key = `${wy}-${w}`;
      if (!usedWeeks.has(key)) { usedWeeks.add(key); weeks.push({ week: w, year: wy }); }
    }
    weeks.sort((a, b) => a.week - b.week);
    months.push({ label, month: mo, year: yr, weeks });
  }
  return months;
}

function currentISOWeek() {
  const now = new Date();
  return { week: isoWeek(now), year: now.getFullYear() };
}

/* Get Monday of a given ISO week */
function getMondayOfWeek(week, year) {
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7;
  const mon1 = new Date(jan4);
  mon1.setDate(jan4.getDate() - dow + 1);
  const result = new Date(mon1);
  result.setDate(mon1.getDate() + (week - 1) * 7);
  return result;
}

const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function getWeekDays(week, year) {
  const monday = getMondayOfWeek(week, year);
  return DAY_NAMES.map((name, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      dayIndex: i + 1,
      name,
      dateStr: `${d.getDate()}.${d.getMonth() + 1}.`,
    };
  });
}

/* ═══════════════════════════════════════════════════
   Default Data
   ═══════════════════════════════════════════════════ */
const INIT_CATS = [
  { id: "c1", name: "Privat" },
  { id: "c2", name: "Haus" },
  { id: "c3", name: "ALEAS" },
];

const INIT_PRIOS = [
  { id: "p1", name: "Hoch", level: 1, color: "#ef4444" },
  { id: "p2", name: "Mittel", level: 2, color: "#f59e0b" },
  { id: "p3", name: "Niedrig", level: 3, color: "#22c55e" },
];

const SAMPLE_TASKS = [
  { id: uid(), title: "Steuererklärung", categoryId: "c1", priorityId: "p1", week: null, year: null, day: null, done: false },
  { id: uid(), title: "Rasen mähen", categoryId: "c2", priorityId: "p2", week: null, year: null, day: null, done: false },
  { id: uid(), title: "Quartalsreport", categoryId: "c3", priorityId: "p1", week: null, year: null, day: null, done: false },
  { id: uid(), title: "Zahnarzt Termin", categoryId: "c1", priorityId: "p2", week: 16, year: 2026, day: 3, done: true },
  { id: uid(), title: "Dach inspizieren", categoryId: "c2", priorityId: "p1", week: 17, year: 2026, day: null, done: false },
];

const MARKER_COLORS = [
  { value: "#bbf7d0" }, { value: "#bfdbfe" }, { value: "#fef08a" },
  { value: "#fecdd3" }, { value: "#e9d5ff" }, { value: "#fed7aa" },
];

/* ═══════════════════════════════════════════════════
   WeekMarkerPopup – mit Tagesbereich (Von/Bis)
   ═══════════════════════════════════════════════════ */
function WeekMarkerPopup({ marker, onSave, onRemove, onClose }) {
  const [text, setText] = useState(marker?.text || "");
  const [color, setColor] = useState(marker?.color || MARKER_COLORS[0].value);
  const [fromDay, setFromDay] = useState(marker?.fromDay ?? 1);
  const [toDay, setToDay] = useState(marker?.toDay ?? 7);
  const doSave = () => text.trim() && onSave({ text: text.trim(), color, fromDay, toDay });
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-xs mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold mb-3">Woche markieren</h3>
        <input autoFocus value={text} onChange={(e) => setText(e.target.value)}
          placeholder="z.B. Urlaub Sardinien"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 mb-3 text-sm focus:ring-2 focus:ring-green-400 focus:border-transparent outline-none"
          onKeyDown={(e) => e.key === "Enter" && doSave()} />
        {/* Day range */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[10px] font-bold text-gray-400 mb-1 block uppercase tracking-widest">Von</label>
            <select value={fromDay} onChange={(e) => { const v = +e.target.value; setFromDay(v); if (v > toDay) setToDay(v); }}
              className="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-sm bg-white">
              {DAY_NAMES.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 mb-1 block uppercase tracking-widest">Bis</label>
            <select value={toDay} onChange={(e) => { const v = +e.target.value; setToDay(v); if (v < fromDay) setFromDay(v); }}
              className="w-full border border-gray-200 rounded-xl px-2 py-1.5 text-sm bg-white">
              {DAY_NAMES.map((d, i) => <option key={i} value={i + 1}>{d}</option>)}
            </select>
          </div>
        </div>
        {/* Day preview bar */}
        <div className="flex gap-1 mb-4">
          {DAY_NAMES.map((d, i) => {
            const active = (i + 1) >= fromDay && (i + 1) <= toDay;
            return (
              <div key={i} className={`flex-1 text-center text-[9px] font-bold py-1 rounded-md transition-colors
                ${active ? "text-gray-700" : "text-gray-300 bg-transparent"}`}
                style={active ? { backgroundColor: color } : undefined}>
                {d}
              </div>
            );
          })}
        </div>
        {/* Colors */}
        <div className="flex gap-2 mb-4">
          {MARKER_COLORS.map((mc) => (
            <button key={mc.value} onClick={() => setColor(mc.value)}
              className={`w-7 h-7 rounded-full transition-all ${color === mc.value ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"}`}
              style={{ backgroundColor: mc.value }} />
          ))}
        </div>
        <div className="flex justify-between">
          {marker?.text ? (
            <button onClick={onRemove} className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition">Entfernen</button>
          ) : <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-500 rounded-xl hover:bg-gray-100 transition">Abbrechen</button>
            <button onClick={doSave} disabled={!text.trim()}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-30 transition font-medium">
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TaskCard
   ═══════════════════════════════════════════════════ */
function TaskCard({ task, priorities, onDragStart, onEdit, onDelete, onToggleDone, small, onUnschedule }) {
  const prio = priorities.find((p) => p.id === task.priorityId);
  const bg = prio?.color || "#9ca3af";
  return (
    <div draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", task.id); e.dataTransfer.effectAllowed = "move"; onDragStart?.(task.id); }}
      className={`group rounded-lg shadow cursor-grab active:cursor-grabbing select-none transition-all hover:shadow-md hover:-translate-y-0.5
        ${small ? "px-1.5 py-0.5" : "px-2.5 py-1.5"} ${task.done ? "opacity-50" : ""}`}
      style={{ backgroundColor: task.done ? "#f3f4f6" : bg + "18", borderLeft: `3px solid ${task.done ? "#d1d5db" : bg}` }}>
      <div className="flex items-center gap-1.5">
        <button onClick={(e) => { e.stopPropagation(); onToggleDone(task.id); }}
          className={`shrink-0 flex items-center justify-center rounded-full border-2 transition-colors
            ${small ? "w-3.5 h-3.5" : "w-5 h-5"}
            ${task.done ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-gray-400 text-transparent hover:text-gray-300"}`}>
          <Check size={small ? 7 : 10} strokeWidth={3} />
        </button>
        <span className={`flex-1 font-medium truncate ${small ? "text-[10px]" : "text-sm"} ${task.done ? "line-through text-gray-400" : ""}`}>
          {task.title}
        </span>
        {task.week != null && !small && (
          <span className="text-[10px] font-mono bg-white/70 rounded px-1 py-0.5 text-gray-500">
            KW{task.week}{task.day ? ` ${DAY_NAMES[task.day - 1]}` : ""}
          </span>
        )}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {small && onUnschedule && (
            <button onClick={(e) => { e.stopPropagation(); onUnschedule(task.id); }}
              className="text-gray-400 hover:text-orange-500 p-0.5" title="Aus Zeitstrahl entfernen">
              <X size={small ? 9 : 10} />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="text-gray-400 hover:text-blue-500 p-0.5">
            <Edit3 size={small ? 9 : 12} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="text-gray-400 hover:text-red-500 p-0.5">
            <Trash2 size={small ? 9 : 12} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DropCell
   ═══════════════════════════════════════════════════ */
function DropCell({ cellId, onDrop, onAdd, children, className = "", style }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`min-h-[28px] p-0.5 transition-colors rounded-sm
        ${over ? "bg-blue-100/80 ring-2 ring-blue-300 ring-inset" : ""} ${className}`}
      style={style}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); const tid = e.dataTransfer.getData("text/plain"); if (tid) onDrop(tid, cellId); }}>
      {children}
      {onAdd && (
        <button onClick={onAdd}
          className="w-full flex items-center justify-center py-0.5 text-gray-200 hover:text-blue-400 transition-colors rounded">
          <Plus size={13} />
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TaskModal
   ═══════════════════════════════════════════════════ */
function TaskModal({ modal, categories, priorities, onSave, onClose }) {
  const [title, setTitle] = useState(modal.task?.title || "");
  const [catId, setCatId] = useState(modal.task?.categoryId || categories[0]?.id);
  const [prioId, setPrioId] = useState(modal.task?.priorityId || priorities[0]?.id);
  const save = () => { if (!title.trim()) return; onSave({ ...modal.task, title: title.trim(), categoryId: catId, priorityId: prioId }); };
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">{modal.mode === "add" ? "Neuer Task" : "Task bearbeiten"}</h3>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Was muss erledigt werden?"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-4 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-sm"
          onKeyDown={(e) => e.key === "Enter" && save()} />
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="text-[10px] font-bold text-gray-400 mb-1.5 block uppercase tracking-widest">Kategorie</label>
            <select value={catId} onChange={(e) => setCatId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 mb-1.5 block uppercase tracking-widest">Priorität</label>
            <select value={prioId} onChange={(e) => setPrioId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
              {priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-xl hover:bg-gray-100 transition">Abbrechen</button>
          <button onClick={save} disabled={!title.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-30 transition font-medium">
            {modal.mode === "add" ? "Erstellen" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Mobile Hook
   ═══════════════════════════════════════════════════ */
function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(typeof window !== "undefined" && window.innerWidth < breakpoint);
  useEffect(() => {
    const cb = () => setMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", cb);
    return () => window.removeEventListener("resize", cb);
  }, [breakpoint]);
  return mobile;
}

/* ═══════════════════════════════════════════════════
   MobileInbox – Schnelles Erfassen am Handy
   ═══════════════════════════════════════════════════ */
function MobileInbox({ tasks, categories, priorities, onAdd, onToggleDone, onDelete, showDone, setShowDone }) {
  const [text, setText] = useState("");
  const [catId, setCatId] = useState(categories[0]?.id);
  const [prioId, setPrioId] = useState(priorities[0]?.id);
  const inputRef = useRef(null);

  const sortedPrios = useMemo(() => [...priorities].sort((a, b) => a.level - b.level), [priorities]);

  const inboxTasks = useMemo(() => {
    const t = tasks.filter((t) => !t.week && !t.year);
    return showDone ? t : t.filter((t) => !t.done);
  }, [tasks, showDone]);

  const scheduledCount = useMemo(() => tasks.filter((t) => t.week && t.year).length, [tasks]);
  const doneCount = useMemo(() => tasks.filter((t) => t.done).length, [tasks]);

  const submit = () => {
    if (!text.trim()) return;
    onAdd({ title: text.trim(), categoryId: catId, priorityId: prioId, week: null, year: null, day: null });
    setText("");
    inputRef.current?.focus();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold flex items-center gap-2 text-gray-700">
            <Inbox size={20} className="text-blue-600" /> Inbox
          </h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowDone((s) => !s)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition ${showDone ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              <Check size={12} /> {doneCount}/{tasks.length}
            </button>
          </div>
        </div>
        {scheduledCount > 0 && (
          <p className="text-xs text-gray-400 mt-1">{scheduledCount} Tasks im Zeitplan – am Desktop organisieren</p>
        )}
      </header>

      {/* Quick-add */}
      <div className="bg-white border-b px-4 py-3 shrink-0 space-y-2">
        <div className="flex gap-2">
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Neuer Task..."
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
            onKeyDown={(e) => e.key === "Enter" && submit()} />
          <button onClick={submit} disabled={!text.trim()}
            className="px-3 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-30 transition">
            <Send size={18} />
          </button>
        </div>
        <div className="flex gap-2">
          <select value={catId} onChange={(e) => setCatId(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-2 py-1.5 text-xs bg-white">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={prioId} onChange={(e) => setPrioId(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-2 py-1.5 text-xs bg-white">
            {sortedPrios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {inboxTasks.length === 0 ? (
          <div className="text-center text-gray-300 py-12">
            <Inbox size={40} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">Inbox leer</p>
          </div>
        ) : (
          <div className="space-y-2">
            {inboxTasks.map((t) => {
              const prio = priorities.find((p) => p.id === t.priorityId);
              const cat = categories.find((c) => c.id === t.categoryId);
              return (
                <div key={t.id}
                  className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border-l-4 transition ${t.done ? "opacity-50" : ""}`}
                  style={{ borderLeftColor: prio?.color || "#9ca3af" }}>
                  <button onClick={() => onToggleDone(t.id)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${t.done ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                    {t.done && <Check size={12} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium block truncate ${t.done ? "line-through text-gray-400" : ""}`}>{t.title}</span>
                    {cat && <span className="text-[10px] text-gray-400">{cat.name}</span>}
                  </div>
                  <button onClick={() => onDelete(t.id)} className="text-gray-300 hover:text-red-500 transition shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SettingsView
   ═══════════════════════════════════════════════════ */
function SettingsView({ categories, setCategories, priorities, setPriorities, onBack }) {
  const [newCat, setNewCat] = useState("");
  const [newPrio, setNewPrio] = useState("");
  const [newPrioColor, setNewPrioColor] = useState("#6366f1");
  const addCat = () => {
    if (!newCat.trim()) return;
    const cat = { id: uid(), name: newCat.trim() };
    const sortOrder = categories.length + 1;
    setCategories((cs) => [...cs, cat]);
    setNewCat("");
    SB.insert("tm_categories", { id: cat.id, name: cat.name, sort_order: sortOrder });
  };
  const deleteCat = (id) => {
    setCategories((cs) => cs.filter((x) => x.id !== id));
    SB.delete("tm_categories", id);
  };
  const addPrio = () => {
    if (!newPrio.trim()) return;
    const mx = priorities.reduce((m, p) => Math.max(m, p.level), 0);
    const prio = { id: uid(), name: newPrio.trim(), level: mx + 1, color: newPrioColor };
    setPriorities((ps) => [...ps, prio]);
    setNewPrio("");
    SB.insert("tm_priorities", { id: prio.id, name: prio.name, level: prio.level, color: prio.color });
  };
  const deletePrio = (id) => {
    setPriorities((ps) => ps.filter((x) => x.id !== id));
    SB.delete("tm_priorities", id);
  };
  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <header className="flex items-center gap-3 px-6 py-3 bg-white border-b shadow-sm shrink-0">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 transition"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold">Einstellungen</h1>
      </header>
      <div className="flex-1 overflow-auto">
        <div className="max-w-lg mx-auto p-6 space-y-8">
          <section>
            <h2 className="text-base font-bold mb-3">Kategorien</h2>
            <p className="text-xs text-gray-400 mb-3">Spalten im Board und Zeitstrahl.</p>
            <div className="space-y-2 mb-3">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm">
                  <span className="flex-1 font-medium text-sm">{c.name}</span>
                  <button onClick={() => deleteCat(c.id)} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Neue Kategorie..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" onKeyDown={(e) => e.key === "Enter" && addCat()} />
              <button onClick={addCat} className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"><Plus size={16} /></button>
            </div>
          </section>
          <section>
            <h2 className="text-base font-bold mb-1">Prioritäten</h2>
            <p className="text-xs text-gray-400 mb-3">Zeilen im Board und Farbe der Post-its.</p>
            <div className="space-y-2 mb-3">
              {[...priorities].sort((a, b) => a.level - b.level).map((p) => (
                <div key={p.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm">
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="flex-1 font-medium text-sm">{p.name}</span>
                  <span className="text-xs text-gray-400">Stufe {p.level}</span>
                  <button onClick={() => deletePrio(p.id)} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newPrio} onChange={(e) => setNewPrio(e.target.value)} placeholder="Neue Priorität..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" onKeyDown={(e) => e.key === "Enter" && addPrio()} />
              <input type="color" value={newPrioColor} onChange={(e) => setNewPrioColor(e.target.value)} className="w-10 h-[38px] rounded-lg cursor-pointer border border-gray-200" />
              <button onClick={addPrio} className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"><Plus size={16} /></button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════ */
export default function TaskManager() {
  const [categories, setCategories] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState("main");
  const [modal, setModal] = useState(null);
  const [showDone, setShowDone] = useState(true);
  const [weekMarkers, setWeekMarkers] = useState({});
  const [editingMarker, setEditingMarker] = useState(null);
  const [expandedWeeks, setExpandedWeeks] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);
  const isMobile = useIsMobile();

  const timeline = useMemo(() => buildTimeline(12), []);
  const sortedPrios = useMemo(() => [...priorities].sort((a, b) => a.level - b.level), [priorities]);
  const now = useMemo(() => currentISOWeek(), []);
  const doneCount = useMemo(() => tasks.filter((t) => t.done).length, [tasks]);
  const visibleTasks = useMemo(() => (showDone ? tasks : tasks.filter((t) => !t.done)), [tasks, showDone]);

  /* ═══════════════════════════════════════════════════
     Supabase: Laden beim Start
     ═══════════════════════════════════════════════════ */
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    (async () => {
      try {
        const [cats, prios, tks, markers] = await Promise.all([
          SB.select("tm_categories", "order=sort_order"),
          SB.select("tm_priorities", "order=level"),
          SB.select("tm_tasks", "order=created_at"),
          SB.select("tm_week_markers"),
        ]);
        if (cats.length) setCategories(cats.map((c) => ({ id: c.id, name: c.name })));
        else setCategories(INIT_CATS);
        if (prios.length) setPriorities(prios.map((p) => ({ id: p.id, name: p.name, level: p.level, color: p.color })));
        else setPriorities(INIT_PRIOS);
        if (tks.length) setTasks(tks.map((t) => ({
          id: t.id, title: t.title, categoryId: t.category_id, priorityId: t.priority_id,
          week: t.week, year: t.year, day: t.day, done: t.done,
        })));
        if (markers.length) {
          const m = {};
          markers.forEach((mk) => { m[`${mk.year}-${mk.week}`] = { id: mk.id, text: mk.text, color: mk.color, fromDay: mk.from_day, toDay: mk.to_day }; });
          setWeekMarkers(m);
        }
      } catch (e) { console.error("Supabase load error:", e); setCategories(INIT_CATS); setPriorities(INIT_PRIOS); }
      setLoading(false);
    })();
  }, []);

  const toggleWeekExpand = useCallback((week, year) => {
    const key = `${year}-${week}`;
    setExpandedWeeks((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }, []);

  /* ── CRUD (mit Supabase-Sync) ── */
  const openAddModal = useCallback((categoryId, priorityId, week, year, day) => {
    setModal({
      mode: "add",
      task: { title: "", categoryId, priorityId: priorityId || sortedPrios[0]?.id, week: week ?? null, year: year ?? null, day: day ?? null },
    });
  }, [sortedPrios]);

  const addTask = useCallback((data) => {
    const id = uid();
    const task = { id, title: data.title, categoryId: data.categoryId, priorityId: data.priorityId, week: data.week ?? null, year: data.year ?? null, day: data.day ?? null, done: false };
    setTasks((ts) => [...ts, task]);
    setModal(null);
    SB.insert("tm_tasks", { id, title: task.title, category_id: task.categoryId, priority_id: task.priorityId, week: task.week, year: task.year, day: task.day, done: false });
  }, []);

  const updateTask = useCallback((data) => {
    setTasks((ts) => ts.map((t) => (t.id === data.id ? { ...t, ...data } : t)));
    setModal(null);
    SB.update("tm_tasks", data.id, { title: data.title, category_id: data.categoryId, priority_id: data.priorityId, week: data.week, year: data.year, day: data.day, done: data.done });
  }, []);

  const deleteTask = useCallback((id) => {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    SB.delete("tm_tasks", id);
  }, []);

  const toggleDone = useCallback((id) => {
    setTasks((ts) => {
      const t = ts.find((x) => x.id === id);
      if (t) SB.update("tm_tasks", id, { done: !t.done });
      return ts.map((x) => (x.id === id ? { ...x, done: !x.done } : x));
    });
  }, []);

  const unscheduleTask = useCallback((id) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, week: null, year: null, day: null } : t)));
    SB.update("tm_tasks", id, { week: null, year: null, day: null });
  }, []);

  /* ── Week Markers (mit Supabase-Sync) ── */
  const saveWeekMarker = useCallback((week, year, data) => {
    setWeekMarkers((m) => ({ ...m, [`${year}-${week}`]: data }));
    setEditingMarker(null);
    SB.upsert("tm_week_markers", { week, year, text: data.text, color: data.color, from_day: data.fromDay, to_day: data.toDay }, "week,year");
  }, []);

  const removeWeekMarker = useCallback((week, year) => {
    setWeekMarkers((m) => { const n = { ...m }; delete n[`${year}-${week}`]; return n; });
    setEditingMarker(null);
    SB.deleteWhere("tm_week_markers", `week=eq.${week}&year=eq.${year}`);
  }, []);

  /* ── Drag & Drop (mit Supabase-Sync) ── */
  const handleBoardDrop = useCallback((taskId, cellId) => {
    const [catId, prioId] = cellId.replace("b|", "").split("|");
    if (catId && prioId) {
      setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, categoryId: catId, priorityId: prioId } : t)));
      SB.update("tm_tasks", taskId, { category_id: catId, priority_id: prioId });
    }
  }, []);

  const handleTimelineDrop = useCallback((taskId, cellId) => {
    const [prefix, ...rest] = cellId.split("|");
    let patch = null;
    switch (prefix) {
      case "tw": patch = { week: +rest[0], year: +rest[1], day: null }; break;
      case "tc": patch = { category_id: rest[0], week: +rest[1], year: +rest[2], day: null }; break;
      case "td": patch = { week: +rest[0], year: +rest[1], day: +rest[2] }; break;
      case "tcd": patch = { category_id: rest[0], week: +rest[1], year: +rest[2], day: +rest[3] }; break;
    }
    if (!patch) return;
    setTasks((ts) => ts.map((t) => {
      if (t.id !== taskId) return t;
      const upd = { ...t, week: patch.week, year: patch.year, day: patch.day };
      if (patch.category_id) upd.categoryId = patch.category_id;
      return upd;
    }));
    SB.update("tm_tasks", taskId, patch);
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <span className="text-sm font-medium">Lade Tasks...</span>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return <MobileInbox tasks={tasks} categories={categories} priorities={priorities}
      onAdd={(data) => { const id = uid(); const task = { id, ...data, done: false }; setTasks((ts) => [...ts, task]); SB.insert("tm_tasks", { id, title: data.title, category_id: data.categoryId, priority_id: data.priorityId, week: null, year: null, day: null, done: false }); }}
      onToggleDone={toggleDone} onDelete={deleteTask} showDone={showDone} setShowDone={setShowDone} />;
  }

  if (view === "settings") {
    return <SettingsView categories={categories} setCategories={setCategories}
      priorities={priorities} setPriorities={setPriorities} onBack={() => setView("main")} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-gray-100 text-gray-800 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-2.5 bg-white/90 backdrop-blur border-b border-gray-200 shrink-0">
        <h1 className="text-lg font-bold flex items-center gap-2 text-gray-700">
          <LayoutGrid size={20} className="text-blue-600" /> Task Manager
        </h1>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowDone((s) => !s)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${showDone ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
            title={showDone ? "Erledigte ausblenden" : "Erledigte einblenden"}>
            <Check size={13} /> {doneCount}/{tasks.length}
          </button>
          <button onClick={() => openAddModal(categories[0]?.id, sortedPrios[0]?.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition shadow-sm">
            <Plus size={15} /> Neuer Task
          </button>
          <button onClick={() => setView("settings")} className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-400">
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Prio Legend */}
      <div className="px-5 pt-2 pb-0.5 flex items-center gap-3 shrink-0">
        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Farblegende:</span>
        {sortedPrios.map((p) => (
          <span key={p.id} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: p.color }} /> {p.name}
          </span>
        ))}
      </div>

      {/* Board */}
      <section className="shrink-0 px-4 pt-2 pb-1">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
          <LayoutGrid size={11} /> Board
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 90 }} />
              {categories.map((c) => <col key={c.id} />)}
            </colgroup>
            <thead>
              <tr className="bg-gray-50/80">
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-2 border-b border-gray-100">Prio</th>
                {categories.map((c) => (
                  <th key={c.id} className="text-center text-sm font-bold px-2 py-2 border-b border-gray-100 text-gray-700">{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPrios.map((p) => (
                <tr key={p.id}>
                  <td className="text-xs font-semibold px-3 py-1 align-top border-r border-gray-50">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span style={{ color: p.color }}>{p.name}</span>
                    </span>
                  </td>
                  {categories.map((c) => {
                    const cellTasks = visibleTasks.filter((t) => t.categoryId === c.id && t.priorityId === p.id);
                    return (
                      <td key={c.id} className="align-top p-0.5">
                        <DropCell cellId={`b|${c.id}|${p.id}`} onDrop={handleBoardDrop}
                          onAdd={() => openAddModal(c.id, p.id)}>
                          <div className="flex flex-col gap-1">
                            {cellTasks.map((t) => (
                              <TaskCard key={t.id} task={t} priorities={priorities} onDragStart={() => {}}
                                onEdit={(task) => setModal({ mode: "edit", task })} onDelete={deleteTask} onToggleDone={toggleDone} />
                            ))}
                          </div>
                        </DropCell>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Divider */}
      <div className="px-4 py-2 shrink-0 flex items-center gap-3">
        <div className="flex-1 border-t-2 border-dashed border-gray-200" />
        <span className="text-[9px] text-gray-300 font-bold uppercase tracking-widest whitespace-nowrap">Tasks nach unten ziehen zum Einplanen</span>
        <div className="flex-1 border-t-2 border-dashed border-gray-200" />
      </div>

      {/* Timeline */}
      <section className="flex-1 px-4 pb-3 min-h-0 flex flex-col">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5 shrink-0">
          <Calendar size={11} /> Zeitstrahl
        </h2>
        <div className="flex-1 overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 90 }} />
              {categories.map((c) => <col key={c.id} />)}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 shadow-sm">
                <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 py-2 border-b border-gray-200">KW</th>
                {categories.map((c) => (
                  <th key={c.id} className="text-center text-xs font-bold px-2 py-2 border-b border-gray-200 text-gray-700">{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeline.map((mo) => (
                <Fragment key={`mo-${mo.year}-${mo.month}`}>
                  <tr>
                    <td colSpan={categories.length + 1} className="bg-gray-100/70 px-3 py-1.5 text-xs font-bold text-gray-600 border-y border-gray-200">
                      {mo.label}
                    </td>
                  </tr>
                  {mo.weeks.map((w) => {
                    const wKey = `${w.year}-${w.week}`;
                    const isCurrent = w.week === now.week && w.year === now.year;
                    const marker = weekMarkers[wKey];
                    const isExpanded = expandedWeeks.has(wKey);
                    const weekDays = isExpanded ? getWeekDays(w.week, w.year) : [];

                    return (
                      <Fragment key={`w-${wKey}`}>
                        {/* Week summary row */}
                        <tr className={isCurrent && !marker ? "bg-blue-50/60" : "hover:bg-gray-50/50"}
                          style={marker ? { backgroundColor: marker.color } : undefined}>
                          <td className={`px-1 py-0.5 text-[11px] font-mono border-b border-gray-100 align-top
                            ${isCurrent && !marker ? "font-bold text-blue-600" : "text-gray-500"}`}>
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => toggleWeekExpand(w.week, w.year)}
                                className="p-0.5 rounded hover:bg-black/5 transition shrink-0">
                                <ChevronRight size={11} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              </button>
                              <DropCell cellId={`tw|${w.week}|${w.year}`} onDrop={handleTimelineDrop}
                                className="flex-1 flex items-center gap-1 rounded cursor-pointer min-h-[24px]">
                                <span onClick={() => toggleWeekExpand(w.week, w.year)} className="whitespace-nowrap">
                                  KW {w.week}
                                </span>
                                {isCurrent && !marker && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />}
                                {marker && (
                                  <span onClick={(e) => { e.stopPropagation(); setEditingMarker({ week: w.week, year: w.year }); }}
                                    className="text-[10px] font-sans font-medium text-gray-600 truncate cursor-pointer hover:text-gray-800">
                                    {marker.text}
                                    {(marker.fromDay !== 1 || marker.toDay !== 7) && (
                                      <span className="text-gray-400 ml-0.5">
                                        ({DAY_NAMES[marker.fromDay - 1]}-{DAY_NAMES[marker.toDay - 1]})
                                      </span>
                                    )}
                                  </span>
                                )}
                                {!marker && (
                                  <span onClick={(e) => { e.stopPropagation(); setEditingMarker({ week: w.week, year: w.year }); }}
                                    className="text-[10px] text-gray-300 cursor-pointer hover:text-blue-500 font-sans ml-1" title="Woche markieren">
                                    +
                                  </span>
                                )}
                              </DropCell>
                            </div>
                          </td>
                          {!isExpanded && categories.map((c) => {
                            const cellTasks = visibleTasks.filter((t) => t.categoryId === c.id && t.week === w.week && t.year === w.year);
                            return (
                              <td key={c.id} className="p-0.5 border-b border-gray-100 align-top">
                                <DropCell cellId={`tc|${c.id}|${w.week}|${w.year}`} onDrop={handleTimelineDrop}
                                  onAdd={() => openAddModal(c.id, sortedPrios[0]?.id, w.week, w.year)}>
                                  <div className="flex flex-col gap-0.5">
                                    {cellTasks.map((t) => (
                                      <TaskCard key={t.id} task={t} priorities={priorities} small onDragStart={() => {}}
                                        onEdit={(task) => setModal({ mode: "edit", task })} onDelete={deleteTask}
                                        onToggleDone={toggleDone} onUnschedule={unscheduleTask} />
                                    ))}
                                  </div>
                                </DropCell>
                              </td>
                            );
                          })}
                          {isExpanded && categories.map((c) => (
                            <td key={c.id} className="p-0 border-b border-gray-100" />
                          ))}
                        </tr>

                        {/* Expanded day rows */}
                        {isExpanded && weekDays.map((d) => {
                          const isWeekend = d.dayIndex >= 6;
                          const isDayMarked = marker && d.dayIndex >= marker.fromDay && d.dayIndex <= marker.toDay;
                          return (
                            <tr key={`d-${wKey}-${d.dayIndex}`}
                              className={!isDayMarked && isWeekend ? "bg-gray-50/40" : ""}
                              style={isDayMarked ? { backgroundColor: marker.color } : undefined}>
                              <td className={`pl-6 pr-1 py-0.5 text-[10px] border-b border-gray-50 ${isWeekend ? "text-gray-300" : "text-gray-400"}`}>
                                <DropCell cellId={`td|${w.week}|${w.year}|${d.dayIndex}`} onDrop={handleTimelineDrop}
                                  className="flex items-center gap-1.5 min-h-[22px]">
                                  <span className="font-bold w-4">{d.name}</span>
                                  <span className="font-mono text-gray-300">{d.dateStr}</span>
                                </DropCell>
                              </td>
                              {categories.map((c) => {
                                const cellTasks = visibleTasks.filter((t) =>
                                  t.categoryId === c.id && t.week === w.week && t.year === w.year &&
                                  (t.day === d.dayIndex || (d.dayIndex === 1 && (t.day === null || t.day === undefined)))
                                );
                                return (
                                  <td key={c.id} className="p-0.5 border-b border-gray-50 align-top">
                                    <DropCell cellId={`tcd|${c.id}|${w.week}|${w.year}|${d.dayIndex}`} onDrop={handleTimelineDrop}
                                      onAdd={() => openAddModal(c.id, sortedPrios[0]?.id, w.week, w.year, d.dayIndex)}>
                                      <div className="flex flex-col gap-0.5">
                                        {cellTasks.map((t) => (
                                          <TaskCard key={t.id} task={t} priorities={priorities} small onDragStart={() => {}}
                                            onEdit={(task) => setModal({ mode: "edit", task })} onDelete={deleteTask}
                                            onToggleDone={toggleDone} onUnschedule={unscheduleTask} />
                                        ))}
                                      </div>
                                    </DropCell>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Task Modal */}
      {modal && (
        <TaskModal modal={modal} categories={categories} priorities={sortedPrios}
          onSave={(data) => modal.mode === "add" ? addTask(data) : updateTask(data)}
          onClose={() => setModal(null)} />
      )}

      {/* Week Marker Popup */}
      {editingMarker && (
        <WeekMarkerPopup
          marker={weekMarkers[`${editingMarker.year}-${editingMarker.week}`]}
          onSave={(data) => saveWeekMarker(editingMarker.week, editingMarker.year, data)}
          onRemove={() => removeWeekMarker(editingMarker.week, editingMarker.year)}
          onClose={() => setEditingMarker(null)} />
      )}
    </div>
  );
}
