import { useState, useEffect, useCallback } from "react";


// ── 型別定義 ──────────────────────────────────────────────────────────────────
interface Record {
  id: number;
  type: "leave" | "grant";
  date: string;
  hours: number;
  note: string;
  carryOver?: number;
}

interface AppData {
  setupDone: boolean;
  grantMonth: number;
  grantDay: number;
  dailyHours: number;
  maxCarryOver: number;
  currentHours: number;
  carryOverHours: number;
  records: Record[];
  grantHistory: Record[];
  lastCheckedYear: number | null;
}

interface SetupForm {
  grantMonth: number;
  grantDay: number;
  dailyHours: number;
  maxCarryOver: number;
  currentHours: number;
}

interface LeaveForm {
  date: string;
  hours: number | string;
  note: string;
}

interface GrantForm {
  newHours: number | string;
  carryOver: boolean;
  carryOverHours: number | string;
}

interface ToastState {
  msg: string;
  type: "success" | "error";
}

// ── 資料初始值 ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "leave_tracker_v1";

const defaultData: AppData = {
  setupDone: false,
  grantMonth: 3,
  grantDay: 5,
  dailyHours: 8,
  maxCarryOver: 240,
  currentHours: 0,
  carryOverHours: 0,
  records: [],
  grantHistory: [],
  lastCheckedYear: null,
};

function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultData, ...JSON.parse(raw) };
  } catch {}
  return { ...defaultData };
}

function saveData(data: AppData): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

// ── 工具函式 ──────────────────────────────────────────────────────────────────
const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

function getDaysInMonth(month: number): number {
  if ([1,3,5,7,8,10,12].includes(month)) return 31;
  if (month === 2) return 28;
  return 30;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Toast 元件 ────────────────────────────────────────────────────────────────
function Toast({ msg, type }: ToastState) {
  return (
    <div style={{
      position: "fixed" as const,
      bottom: 32,
      left: "50%",
      transform: "translateX(-50%)",
      background: type === "error" ? "#ff6b6b" : "#a9f5c8",
      color: type === "error" ? "#fff" : "#0a0a14",
      padding: "12px 24px",
      borderRadius: 100,
      fontWeight: 700,
      fontSize: 14,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      zIndex: 9999,
      whiteSpace: "nowrap" as const,
    }}>{msg}</div>
  );
}

// ── 主元件 ────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState<AppData>(loadData);
  const [view, setView] = useState<"main" | "history" | "setup">("main");
  const [modal, setModal] = useState<"leave" | "grantCheck" | null>(null);
  const [leaveForm, setLeaveForm] = useState<LeaveForm>({ date: today(), hours: "", note: "" });
  const [grantForm, setGrantForm] = useState<GrantForm>({ newHours: "", carryOver: false, carryOverHours: "" });
  const [editRecord, setEditRecord] = useState<Record | null>(null);
  const [setupForm, setSetupForm] = useState<SetupForm>({ grantMonth: 3, grantDay: 5, dailyHours: 8, maxCarryOver: 240, currentHours: 0 });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "leave" | "grant">("all");

  const updateData = useCallback((updates: Partial<AppData>) => {
    setData(prev => {
      const next = { ...prev, ...updates };
      saveData(next);
      return next;
    });
  }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (!data.setupDone) return;
    const now = new Date();
    const yr = now.getFullYear(), mo = now.getMonth() + 1, day = now.getDate();
    if (mo === data.grantMonth && day === data.grantDay && data.lastCheckedYear !== yr) {
      setModal("grantCheck");
    }
  }, [data.setupDone, data.grantMonth, data.grantDay, data.lastCheckedYear]);

  const totalHours = data.currentHours + data.carryOverHours;
  const usedHours = data.records.filter(r => r.type === "leave").reduce((s, r) => s + r.hours, 0);
  const remainHours = totalHours - usedHours;
  const pct = totalHours > 0 ? Math.max(0, Math.min(100, (remainHours / totalHours) * 100)) : 0;
  const C = 2 * Math.PI * 64;

  // ── 初始設定畫面 ───────────────────────────────────────────────────────────
  if (!data.setupDone) {
    return (
      <div style={S.root}>
        <div style={S.setupCard}>
          <div style={{ fontSize: 52, textAlign: "center" as const, marginBottom: 16 }}>🌿</div>
          <h1 style={S.setupTitle}>特休時數管理</h1>
          <p style={S.setupSub}>先完成初始設定，開始管理你的特休假</p>

          <div style={S.fg}>
            <label style={S.lbl}>給假日期（週年制）</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select style={S.sel} value={setupForm.grantMonth}
                onChange={e => setSetupForm(p => ({ ...p, grantMonth: +e.target.value }))}>
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select style={S.sel} value={setupForm.grantDay}
                onChange={e => setSetupForm(p => ({ ...p, grantDay: +e.target.value }))}>
                {Array.from({ length: getDaysInMonth(setupForm.grantMonth) }, (_, i) => i+1).map(d =>
                  <option key={d} value={d}>{d}日</option>)}
              </select>
            </div>
          </div>

          <div style={S.fg}>
            <label style={S.lbl}>每日工時（小時）</label>
            <input style={S.inp} type="number" min="1" max="24" value={setupForm.dailyHours}
              onChange={e => setSetupForm(p => ({ ...p, dailyHours: +e.target.value }))} />
          </div>

          <div style={S.fg}>
            <label style={S.lbl}>累計上限（小時，0 = 無上限）</label>
            <input style={S.inp} type="number" min="0" value={setupForm.maxCarryOver}
              onChange={e => setSetupForm(p => ({ ...p, maxCarryOver: +e.target.value }))} />
          </div>

          <div style={S.fg}>
            <label style={S.lbl}>目前特休時數（小時）</label>
            <input style={S.inp} type="number" min="0" value={setupForm.currentHours}
              onChange={e => setSetupForm(p => ({ ...p, currentHours: +e.target.value }))} />
          </div>

          <button style={S.btnP} onClick={() => {
            updateData({
              setupDone: true,
              grantMonth: setupForm.grantMonth,
              grantDay: setupForm.grantDay,
              dailyHours: setupForm.dailyHours,
              maxCarryOver: setupForm.maxCarryOver,
              currentHours: setupForm.currentHours,
            });
            showToast("設定完成，開始使用！");
          }}>開始使用 →</button>
        </div>
        {toast && <Toast {...toast} />}
      </div>
    );
  }

  // ── 給假日彈窗 ────────────────────────────────────────────────────────────
  if (modal === "grantCheck") {
    const unused = Math.max(0, remainHours);
    return (
      <div style={S.root}>
        <div style={S.modalCard}>
          <div style={{ fontSize: 52, textAlign: "center" as const, marginBottom: 12 }}>🎉</div>
          <h2 style={S.modalTitle}>給假日到了！</h2>
          <p style={S.modalSub}>今天是你的週年特休給假日<br />請輸入本年度新增的特休時數</p>

          <div style={S.fg}>
            <label style={S.lbl}>新增特休時數（小時）</label>
            <input style={S.inp} type="number" min="0" placeholder="例：80"
              value={grantForm.newHours as string}
              onChange={e => setGrantForm(p => ({ ...p, newHours: e.target.value }))} />
          </div>

          <div style={{ ...S.fg, background: "#1a1a28", borderRadius: 12, padding: "14px 16px" }}>
            <label style={{ display: "flex", gap: 10, alignItems: "center", color: "#c0c0d0", fontSize: 15, cursor: "pointer" }}>
              <input type="checkbox" checked={grantForm.carryOver}
                onChange={e => setGrantForm(p => ({ ...p, carryOver: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: "#a9f5c8" }} />
              <span>累計去年未休時數（{unused} 小時可累計）</span>
            </label>
            {grantForm.carryOver && (
              <div style={{ marginTop: 12 }}>
                <label style={S.lbl}>累計時數（最多 {unused} 小時）</label>
                <input style={S.inp} type="number" min="0" max={unused}
                  value={grantForm.carryOverHours as string}
                  onChange={e => setGrantForm(p => ({ ...p, carryOverHours: e.target.value }))} />
              </div>
            )}
          </div>

          <button style={{ ...S.btnP, marginTop: 8 }} onClick={() => {
            const newH = parseFloat(grantForm.newHours as string) || 0;
            const carryH = grantForm.carryOver ? Math.min(parseFloat(grantForm.carryOverHours as string) || 0, unused) : 0;
            const yr = new Date().getFullYear();
            const entry: Record = { id: Date.now(), type: "grant", date: today(), hours: newH, carryOver: carryH, note: `${yr}年度給假` };
            updateData({
              currentHours: newH,
              carryOverHours: carryH,
              records: [...data.records.filter(r => r.type === "leave"), entry],
              grantHistory: [...(data.grantHistory || []), entry],
              lastCheckedYear: yr,
            });
            setModal(null);
            setGrantForm({ newHours: "", carryOver: false, carryOverHours: "" });
            showToast(`已新增 ${newH} 小時特休 🎉`);
          }}>確認新增</button>
          <button style={S.btnG} onClick={() => {
            updateData({ lastCheckedYear: new Date().getFullYear() });
            setModal(null);
          }}>稍後設定</button>
        </div>
        {toast && <Toast {...toast} />}
      </div>
    );
  }

  // ── 歷史紀錄畫面 ──────────────────────────────────────────────────────────
  if (view === "history") {
    const allR = [...data.records].sort((a, b) => b.date.localeCompare(a.date));
    const fil = historyFilter === "all" ? allR : allR.filter(r => r.type === historyFilter);

    return (
      <div style={S.root}>
        <div style={S.page}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <button style={S.backBtn} onClick={() => setView("main")}>← 返回</button>
            <h2 style={{ color: "#f0f0f8", fontSize: 22, fontWeight: 700, margin: 0 }}>歷史紀錄</h2>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(["all", "leave", "grant"] as const).map(f => (
              <button key={f} style={{ ...S.filtBtn, ...(historyFilter === f ? S.filtActive : {}) }}
                onClick={() => setHistoryFilter(f)}>
                {f === "all" ? "全部" : f === "leave" ? "請假" : "給假"}
              </button>
            ))}
          </div>

          {fil.length === 0 && <div style={S.empty}>尚無紀錄</div>}

          <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
            {fil.map(r => (
              <div key={r.id} style={{ background: "#141420", borderRadius: 14, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #2a2a40" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ padding: "4px 10px", borderRadius: 100, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" as const,
                    background: r.type === "leave" ? "#ff6b6b22" : "#51cf6622",
                    color: r.type === "leave" ? "#ff6b6b" : "#51cf66" }}>
                    {r.type === "leave" ? "請假" : "給假"}
                  </span>
                  <div>
                    <div style={{ color: "#c0c0d0", fontSize: 14, fontWeight: 600 }}>{formatDate(r.date)}</div>
                    {r.note && <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>{r.note}</div>}
                    {r.carryOver && r.carryOver > 0 && <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>含累計 {r.carryOver} 小時</div>}
                  </div>
                </div>
                <div style={{ textAlign: "right" as const }}>
                  <div style={{ color: r.type === "leave" ? "#ff6b6b" : "#51cf66", fontWeight: 700, fontSize: 18 }}>
                    {r.type === "leave" ? "-" : "+"}{r.hours}h
                  </div>
                  {r.type === "leave" && (
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <button style={S.iconBtn} onClick={() => {
                        setEditRecord(r);
                        setLeaveForm({ date: r.date, hours: r.hours, note: r.note || "" });
                      }}>✏️</button>
                      <button style={S.iconBtn} onClick={() => {
                        if (window.confirm("確定刪除這筆紀錄？")) {
                          updateData({ records: data.records.filter(x => x.id !== r.id) });
                          showToast("已刪除");
                        }
                      }}>🗑️</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {editRecord && (
          <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) setEditRecord(null); }}>
            <div style={S.drawer}>
              <h3 style={S.dTitle}>✏️ 編輯請假紀錄</h3>
              <div style={S.fg}><label style={S.lbl}>請假日期</label>
                <input style={S.inp} type="date" value={leaveForm.date}
                  onChange={e => setLeaveForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div style={S.fg}><label style={S.lbl}>使用時數</label>
                <input style={S.inp} type="number" min="0.5" step="0.5" value={leaveForm.hours as number}
                  onChange={e => setLeaveForm(p => ({ ...p, hours: e.target.value }))} />
              </div>
              <div style={S.fg}><label style={S.lbl}>備註</label>
                <input style={S.inp} type="text" value={leaveForm.note}
                  onChange={e => setLeaveForm(p => ({ ...p, note: e.target.value }))} />
              </div>
              <button style={S.btnP} onClick={() => {
                const h = parseFloat(leaveForm.hours as string);
                if (!h || h <= 0) return showToast("請輸入有效時數", "error");
                updateData({ records: data.records.map(r =>
                  r.id === editRecord.id ? { ...r, date: leaveForm.date, hours: h, note: leaveForm.note } : r
                )});
                setEditRecord(null);
                showToast("已更新");
              }}>儲存變更</button>
              <button style={S.btnG} onClick={() => setEditRecord(null)}>取消</button>
            </div>
          </div>
        )}
        {toast && <Toast {...toast} />}
      </div>
    );
  }

  // ── 設定畫面 ──────────────────────────────────────────────────────────────
  if (view === "setup") {
    return (
      <div style={S.root}>
        <div style={S.page}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <button style={S.backBtn} onClick={() => setView("main")}>← 返回</button>
            <h2 style={{ color: "#f0f0f8", fontSize: 22, fontWeight: 700, margin: 0 }}>⚙️ 設定</h2>
          </div>

          <div style={S.fg}>
            <label style={S.lbl}>給假日期</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select style={S.sel} value={setupForm.grantMonth}
                onChange={e => setSetupForm(p => ({ ...p, grantMonth: +e.target.value }))}>
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select style={S.sel} value={setupForm.grantDay}
                onChange={e => setSetupForm(p => ({ ...p, grantDay: +e.target.value }))}>
                {Array.from({ length: getDaysInMonth(setupForm.grantMonth) }, (_, i) => i+1).map(d =>
                  <option key={d} value={d}>{d}日</option>)}
              </select>
            </div>
          </div>

          <div style={S.fg}>
            <label style={S.lbl}>每日工時（小時）</label>
            <input style={S.inp} type="number" min="1" max="24" value={setupForm.dailyHours}
              onChange={e => setSetupForm(p => ({ ...p, dailyHours: +e.target.value }))} />
          </div>

          <div style={S.fg}>
            <label style={S.lbl}>累計上限（0 = 無上限）</label>
            <input style={S.inp} type="number" min="0" value={setupForm.maxCarryOver}
              onChange={e => setSetupForm(p => ({ ...p, maxCarryOver: +e.target.value }))} />
          </div>

          <button style={S.btnP} onClick={() => {
            updateData({
              grantMonth: setupForm.grantMonth,
              grantDay: setupForm.grantDay,
              dailyHours: setupForm.dailyHours,
              maxCarryOver: setupForm.maxCarryOver,
            });
            setView("main");
            showToast("設定已更新");
          }}>儲存設定</button>

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #2a2a40" }}>
            <p style={{ color: "#555", fontSize: 13, marginBottom: 12 }}>危險區域</p>
            <button style={{ ...S.btnG, color: "#ff6b6b", borderColor: "#ff6b6b44" }} onClick={() => {
              if (window.confirm("確定要重設所有資料？此操作無法復原。")) {
                localStorage.removeItem(STORAGE_KEY);
                setData({ ...defaultData });
                setView("main");
                showToast("已重設所有資料");
              }
            }}>🗑️ 重設所有資料</button>
          </div>
        </div>
        {toast && <Toast {...toast} />}
      </div>
    );
  }

  // ── 主畫面 ────────────────────────────────────────────────────────────────
  const recentLeaves = data.records.filter(r => r.type === "leave").slice(-3).reverse();

  return (
    <div style={S.root}>
      <div style={S.page}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f0f0f8", margin: 0 }}>特休管理</h1>
            <p style={{ fontSize: 13, color: "#555", margin: "4px 0 0" }}>給假日：每年 {data.grantMonth}月{data.grantDay}日</p>
          </div>
          <button style={{ background: "#1a1a28", border: "1px solid #2a2a40", borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontSize: 17 }}
            onClick={() => {
              setSetupForm({ grantMonth: data.grantMonth, grantDay: data.grantDay, dailyHours: data.dailyHours, maxCarryOver: data.maxCarryOver, currentHours: data.currentHours });
              setView("setup");
            }}>⚙️</button>
        </div>

        <div style={S.bigCard}>
          <div style={{ position: "relative" as const, width: 160, height: 160 }}>
            <svg width="160" height="160" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="64" fill="none" stroke="#1e1e2e" strokeWidth="14" />
              <circle cx="80" cy="80" r="64" fill="none"
                stroke={remainHours < 0 ? "#ff6b6b" : remainHours < data.dailyHours ? "#ffa94d" : "#a9f5c8"}
                strokeWidth="14"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct / 100)}
                strokeLinecap="round"
                style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.8s ease" }} />
            </svg>
            <div style={{ position: "absolute" as const, inset: 0, display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 34, fontWeight: 800, color: "#f0f0f8", lineHeight: 1 }}>{remainHours.toFixed(1)}</div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>剩餘小時</div>
            </div>
          </div>

          <div style={{ display: "flex", width: "100%", justifyContent: "space-around", alignItems: "center" }}>
            {[
              { num: totalHours.toFixed(1), label: "總時數" },
              { num: usedHours.toFixed(1), label: "已使用" },
              { num: (remainHours / data.dailyHours).toFixed(1), label: "剩餘天數" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                {i > 0 && <div style={{ width: 1, height: 32, background: "#2a2a40", marginRight: 8 }} />}
                <div style={{ textAlign: "center" as const, flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f8" }}>{s.num}</div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {data.carryOverHours > 0 && (
            <div style={{ background: "#a9f5c822", color: "#a9f5c8", padding: "4px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600 }}>
              含去年累計 {data.carryOverHours}h
            </div>
          )}
        </div>

        {remainHours < 0 && (
          <div style={{ ...S.warn, background: "#ff6b6b18", color: "#ff6b6b" }}>
            ❗ 特休已超用 {Math.abs(remainHours).toFixed(1)} 小時
          </div>
        )}
        {remainHours >= 0 && remainHours < data.dailyHours && (
          <div style={S.warn}>⚠️ 特休時數即將用完！</div>
        )}

        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <button style={S.btnLeave} onClick={() => { setLeaveForm({ date: today(), hours: "", note: "" }); setModal("leave"); }}>
            <span style={{ fontSize: 24 }}>😇</span>
            <span style={{ fontWeight: 700 }}>申請請假</span>
          </button>
          <button style={S.btnSec} onClick={() => setView("history")}>
            <span style={{ fontSize: 24 }}>📋</span>
            <span style={{ fontWeight: 700 }}>歷史紀錄</span>
          </button>
        </div>

        <div style={{ background: "#141420", borderRadius: 16, padding: "20px", border: "1px solid #2a2a40" }}>
          <div style={{ fontSize: 12, color: "#444", fontWeight: 700, marginBottom: 14, letterSpacing: "0.8px" }}>最近請假</div>
          {recentLeaves.length === 0 && <div style={S.empty}>尚無請假紀錄</div>}
          {recentLeaves.map(r => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1e1e2e" }}>
              <div>
                <span style={{ color: "#888", fontSize: 14 }}>{formatDate(r.date)}</span>
                {r.note && <span style={{ color: "#444", fontSize: 12, marginLeft: 8 }}>{r.note}</span>}
              </div>
              <span style={{ color: "#ff6b6b", fontWeight: 700 }}>-{r.hours}h</span>
            </div>
          ))}
        </div>
      </div>

      {modal === "leave" && (
        <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={S.drawer}>
            <h3 style={S.dTitle}>😇 申請請假</h3>

            <div style={S.fg}>
              <label style={S.lbl}>請假日期</label>
              <input style={S.inp} type="date" value={leaveForm.date}
                onChange={e => setLeaveForm(p => ({ ...p, date: e.target.value }))} />
            </div>

            <div style={S.fg}>
              <label style={S.lbl}>使用時數</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 8 }}>
                {[data.dailyHours/2, data.dailyHours, data.dailyHours*1.5, data.dailyHours*2].map(h => (
                  <button key={h} style={{ ...S.qBtn, ...(+leaveForm.hours === h ? S.qActive : {}) }}
                    onClick={() => setLeaveForm(p => ({ ...p, hours: h }))}>
                    {h}h
                  </button>
                ))}
              </div>
              <input style={S.inp} type="number" min="0.5" step="0.5" placeholder="或手動輸入時數"
                value={leaveForm.hours as number}
                onChange={e => setLeaveForm(p => ({ ...p, hours: e.target.value }))} />
            </div>

            <div style={S.fg}>
              <label style={S.lbl}>備註（選填）</label>
              <input style={S.inp} type="text" placeholder="例：出遊、就醫、家庭事由..."
                value={leaveForm.note}
                onChange={e => setLeaveForm(p => ({ ...p, note: e.target.value }))} />
            </div>

            {+leaveForm.hours > 0 && (
              <div style={{ background: "#1a1a28", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", marginBottom: 20, fontSize: 14, color: "#888", border: "1px solid #2a2a40" }}>
                <span>請假後剩餘</span>
                <span style={{ fontWeight: 700, color: (remainHours - +leaveForm.hours) < 0 ? "#ff6b6b" : "#a9f5c8" }}>
                  {(remainHours - +leaveForm.hours).toFixed(1)} 小時
                </span>
              </div>
            )}

            <button style={S.btnP} onClick={() => {
              const h = parseFloat(leaveForm.hours as string);
              if (!h || h <= 0) return showToast("請輸入有效時數", "error");
              if (!leaveForm.date) return showToast("請選擇日期", "error");
              updateData({ records: [...data.records, { id: Date.now(), type: "leave", date: leaveForm.date, hours: h, note: leaveForm.note }] });
              setModal(null);
              showToast(`已記錄請假 ${h} 小時`);
            }}>確認請假</button>
            <button style={S.btnG} onClick={() => setModal(null)}>取消</button>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </div>
  );
}

// ── 樣式 ──────────────────────────────────────────────────────────────────────
const S = {
  root:       { minHeight: "100vh", background: "#0a0a14", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "0 0 60px", fontFamily: "'Noto Sans TC','PingFang TC',sans-serif" },
  page:       { width: "100%", maxWidth: 480, padding: "32px 20px" },
  setupCard:  { width: "100%", maxWidth: 480, padding: "48px 24px" },
  setupTitle: { fontSize: 28, fontWeight: 800, color: "#f0f0f8", textAlign: "center" as const, margin: "0 0 8px" },
  setupSub:   { fontSize: 14, color: "#666", textAlign: "center" as const, marginBottom: 40 },
  bigCard:    { background: "linear-gradient(135deg,#141420 0%,#1a1a2e 100%)", borderRadius: 24, padding: "32px 24px", border: "1px solid #2a2a40", marginBottom: 16, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 24 },
  warn:       { background: "#ffa94d18", color: "#ffa94d", borderRadius: 12, padding: "12px 16px", fontSize: 13, marginBottom: 16, fontWeight: 600 },
  btnLeave:   { flex: 1, background: "linear-gradient(135deg,#a9f5c8,#4ade80)", color: "#0a0a14", border: "none", borderRadius: 16, padding: "18px", fontSize: 15, cursor: "pointer", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 6, boxShadow: "0 4px 20px rgba(169,245,200,0.25)" },
  btnSec:     { flex: 1, background: "#1a1a28", color: "#c0c0d0", border: "1px solid #2a2a40", borderRadius: 16, padding: "18px", fontSize: 15, cursor: "pointer", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 6 },
  btnP:       { width: "100%", background: "linear-gradient(135deg,#a9f5c8,#4ade80)", color: "#0a0a14", border: "none", borderRadius: 14, padding: "16px", fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 12 },
  btnG:       { width: "100%", background: "transparent", color: "#555", border: "1px solid #2a2a40", borderRadius: 14, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  fg:         { marginBottom: 20 },
  lbl:        { display: "block", fontSize: 13, color: "#888", marginBottom: 8, fontWeight: 600 },
  inp:        { width: "100%", background: "#0a0a14", border: "1px solid #2a2a40", borderRadius: 12, padding: "12px 16px", color: "#f0f0f8", fontSize: 16, outline: "none", boxSizing: "border-box" as const },
  sel:        { flex: 1, background: "#0a0a14", border: "1px solid #2a2a40", borderRadius: 12, padding: "12px 16px", color: "#f0f0f8", fontSize: 15, outline: "none" },
  qBtn:       { background: "#1a1a28", border: "1px solid #2a2a40", borderRadius: 10, padding: "8px 16px", color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  qActive:    { background: "#a9f5c822", borderColor: "#a9f5c8", color: "#a9f5c8" },
  overlay:    { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" },
  drawer:     { background: "#141420", borderRadius: "24px 24px 0 0", padding: "32px 24px 48px", width: "100%", maxWidth: 480, border: "1px solid #2a2a40", borderBottom: "none" },
  dTitle:     { color: "#f0f0f8", fontSize: 20, fontWeight: 700, margin: "0 0 24px" },
  modalCard:  { width: "100%", maxWidth: 420, background: "#141420", borderRadius: 24, padding: "40px 28px", border: "1px solid #2a2a40", margin: "auto", alignSelf: "center" },
  modalTitle: { fontSize: 24, fontWeight: 800, color: "#f0f0f8", textAlign: "center" as const, margin: "0 0 8px" },
  modalSub:   { fontSize: 14, color: "#666", textAlign: "center" as const, marginBottom: 32, lineHeight: 1.7 },
  backBtn:    { background: "none", border: "none", color: "#888", fontSize: 15, cursor: "pointer", padding: 0 },
  filtBtn:    { background: "#1a1a28", border: "1px solid #2a2a40", borderRadius: 100, padding: "8px 18px", color: "#666", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  filtActive: { background: "#a9f5c822", borderColor: "#a9f5c8", color: "#a9f5c8" },
  iconBtn:    { background: "#1a1a28", border: "1px solid #2a2a40", borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontSize: 13 },
  empty:      { textAlign: "center" as const, color: "#444", padding: "20px 0", fontSize: 14 },
};