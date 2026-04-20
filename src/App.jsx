
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
//import * as XLSX from "xlsx";

const catalog = [
  { id: 1, name: "Blauwe vest", points: 40, excelHeader: "Blauwe vest - 40" },
  { id: 2, name: "Bodywarmer", points: 40, excelHeader: "Bodywarmer - 40" },
  { id: 3, name: "Broek (lang)", points: 70, excelHeader: "Broek (lang) - 70" },
  { id: 4, name: "Fleece", points: 20, excelHeader: "Fleece - 20" },
  { id: 5, name: "Jas", points: 80, excelHeader: "Jas - 80" },
  { id: 6, name: "Korte short", points: 80, excelHeader: "Korte short - 80" },
  { id: 7, name: "Lange short", points: 50, excelHeader: "Lange short - 50" },
  { id: 8, name: "Polo", points: 0, excelHeader: "Polo - 0" },
  { id: 9, name: "Schoenen", points: 70, excelHeader: "Schoenen - 70" },
  { id: 10, name: "Sokken (1 paar)", points: 10, excelHeader: "Sokken (1 paar) - 10" },
  { id: 11, name: "Sweater", points: 20, excelHeader: "Sweater - 20" },
  { id: 12, name: "T-shirt", points: 0, excelHeader: "T-shirt - 0" },
  { id: 13, name: "T-shirt premium", points: 1, excelHeader: "T-shirt - 1" },
];

const initialEmployees = [
  {
    id: 1,
    firstName: "Mark",
    lastName: "Meeus",
    fullName: "Meeus Mark",
    status: "Bediende",
    basePoints: 40,
    extraPoints: 20,
    importedSpent: null,
    importedRemaining: null,
    orders: [
      { id: 101, date: "2026-02-10", status: "Geïmporteerd", items: [{ itemId: 1, qty: 1 }, { itemId: 11, qty: 1 }] },
      { id: 102, date: "2026-03-22", status: "Geïmporteerd", items: [{ itemId: 10, qty: 2 }] },
    ],
  },
  {
    id: 2,
    firstName: "An",
    lastName: "Peeters",
    fullName: "Peeters An",
    status: "Arbeider",
    basePoints: 300,
    extraPoints: 0,
    importedSpent: null,
    importedRemaining: null,
    orders: [{ id: 201, date: "2026-01-15", status: "Geïmporteerd", items: [{ itemId: 3, qty: 2 }, { itemId: 9, qty: 1 }] }],
  },
  {
    id: 3,
    firstName: "Tom",
    lastName: "Janssens",
    fullName: "Janssens Tom",
    status: "Arbeider",
    basePoints: 300,
    extraPoints: 30,
    importedSpent: null,
    importedRemaining: null,
    orders: [{ id: 301, date: "2026-04-05", status: "In aanvraag", items: [{ itemId: 5, qty: 1 }, { itemId: 12, qty: 3 }] }],
  },
  {
    id: 4,
    firstName: "Els",
    lastName: "Vermeulen",
    fullName: "Vermeulen Els",
    status: "Bediende",
    basePoints: 40,
    extraPoints: 10,
    importedSpent: null,
    importedRemaining: null,
    orders: [],
  },
];

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const normalized = String(value).replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getItem(itemId) {
  return catalog.find((item) => item.id === itemId);
}

function calcSpent(orders) {
  return (orders || []).reduce((total, order) => {
    const orderTotal = order.items.reduce((sum, line) => sum + (getItem(line.itemId)?.points || 0) * line.qty, 0);
    return total + orderTotal;
  }, 0);
}

function calcEmployee(employee) {
  const basePoints = employee.basePoints ?? (employee.status === "Arbeider" ? 300 : 40);
  const budget = basePoints + (employee.extraPoints || 0);
  const calculatedSpent = calcSpent(employee.orders || []);
  const spent = employee.importedSpent ?? calculatedSpent;
  const remaining = employee.importedRemaining ?? (budget - spent);
  return { ...employee, basePoints, budget, spent, remaining };
}

function formatDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString("nl-BE");
}

function buildImportedOrderLines(row) {
  return catalog
    .map((item) => ({ itemId: item.id, qty: toNumber(row[item.excelHeader]) }))
    .filter((line) => line.qty > 0);
}

function parseEmployeesFromWorkbook(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets["INVOER"];
  if (!sheet) throw new Error("Het werkblad 'INVOER' werd niet gevonden.");

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const importedEmployees = rows
    .filter((row) => row["Achternaam"] || row["Voornaam"])
    .map((row, index) => {
      const status = row["Statuut"] || "Bediende";
      const extraPoints = toNumber(row["EXTRA punten"]);
      const basePoints = status === "Arbeider" ? 300 : 40;
      const importedSpent = row["Verbruikt"] === "" ? null : toNumber(row["Verbruikt"]);
      const importedRemaining = row["Resterend"] === "" ? null : toNumber(row["Resterend"]);
      const items = buildImportedOrderLines(row);

      return {
        id: index + 1,
        firstName: String(row["Voornaam"] || "").trim(),
        lastName: String(row["Achternaam"] || "").trim(),
        fullName: String(row["Naam + Voornaam"] || `${row["Achternaam"] || ""} ${row["Voornaam"] || ""}`).trim(),
        status,
        basePoints,
        extraPoints,
        importedSpent,
        importedRemaining,
        orders: items.length
          ? [{
              id: Number(`9${index + 1}`),
              date: "2026-01-01",
              status: "Geïmporteerd uit Excel",
              items,
            }]
          : [],
      };
    });

  return {
    employees: importedEmployees,
    importedAt: new Date().toISOString(),
    rowCount: importedEmployees.length,
  };
}

function styles() {
  return {
    page: { minHeight: "100vh", background: "#f1f5f9", color: "#0f172a" },
    container: { maxWidth: 1200, margin: "0 auto", padding: 16 },
    card: { background: "#fff", borderRadius: 20, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
    grid: { display: "grid", gap: 16 },
    statGrid: { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" },
    twoCol: { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" },
    input: { width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid #cbd5e1", fontSize: 14 },
    button: { padding: "12px 16px", borderRadius: 14, border: "none", background: "#0f172a", color: "#fff", cursor: "pointer", fontWeight: 600 },
    buttonAlt: { padding: "10px 14px", borderRadius: 14, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" },
    badge: { display: "inline-block", padding: "5px 10px", borderRadius: 999, background: "#e2e8f0", fontSize: 12 },
    badgeOutline: { display: "inline-block", padding: "5px 10px", borderRadius: 999, border: "1px solid #94a3b8", fontSize: 12 },
    badgeRed: { display: "inline-block", padding: "5px 10px", borderRadius: 999, background: "#fee2e2", color: "#991b1b", fontSize: 12 },
    tableWrap: { overflowX: "auto" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
    th: { textAlign: "left", padding: "12px 10px", borderBottom: "1px solid #e2e8f0", color: "#475569" },
    td: { padding: "12px 10px", borderBottom: "1px solid #e2e8f0", verticalAlign: "top" },
    muted: { color: "#64748b", fontSize: 14 },
    title: { margin: 0, fontSize: 30, fontWeight: 700 },
    subtitle: { marginTop: 6, color: "#64748b" },
    nav: { display: "flex", gap: 10, flexWrap: "wrap" },
    sectionTitle: { margin: "0 0 14px 0", fontSize: 20 },
    small: { fontSize: 12, color: "#64748b" },
    alert: { background: "#eff6ff", color: "#1d4ed8", padding: 14, borderRadius: 14, border: "1px solid #bfdbfe" },
  };
}

function LoginScreen({ employees, onLogin }) {
  const s = styles();
  const [role, setRole] = useState("admin");
  const [employeeId, setEmployeeId] = useState(String(employees[0]?.id || "1"));

  return (
    <div style={s.page}>
      <div style={{ ...s.container, minHeight: "100vh", display: "grid", alignItems: "center" }}>
        <div style={{ ...s.grid, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
          <div style={{ ...s.card }}>
            <div style={{ ...s.badge, background: "#0f172a", color: "#fff" }}>Prototype PWA</div>
            <h1 style={{ ...s.title, marginTop: 14 }}>Werkkledij Wilms</h1>
            <p style={s.subtitle}>Mobiele webapp voor werknemers en beheerder, met Excel-import en aanvragen-flow.</p>
            <div style={{ ...s.card, marginTop: 18, background: "#0f172a", color: "#fff", boxShadow: "none" }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Gebruik op iPhone</div>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                Open straks de link in Safari en kies <strong>Deel → Zet op beginscherm</strong>.
              </div>
            </div>
          </div>

          <div style={s.card}>
            <h2 style={{ marginTop: 0 }}>Aanmelden</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={s.small}>Rol</label>
              <select style={s.input} value={role} onChange={(e) => setRole(e.target.value)}>
  <option value="admin">Beheerder</option>
</select>
            </div>
            
            <button style={{ ...s.button, width: "100%" }} onClick={() => onLogin(role, employeeId)}>Open app</button>
            <p style={{ ...s.small, marginTop: 12 }}>Demo-login zonder wachtwoord. In de echte versie voeg je bedrijfslogin toe.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImportPanel({ onImport, importMeta, importError }) {
  const s = styles();
  const [loading, setLoading] = useState(false);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseEmployeesFromWorkbook(buffer);
      onImport(parsed, file.name);
    } catch (error) {
      onImport(null, file.name, error instanceof Error ? error.message : "Import mislukt.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  return (
    <div style={s.card}>
      <h3 style={s.sectionTitle}>Excel import</h3>
      <p style={s.muted}>Gebruik het werkblad <strong>INVOER</strong> met naam, statuut, verbruikt, resterend, artikelkolommen en <strong>EXTRA punten</strong>.</p>
      <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
      {loading && <p style={s.small}>Importeren...</p>}
      {importMeta && <div style={{ ...s.alert, marginTop: 12 }}><strong>{importMeta.fileName}</strong> ingelezen. {importMeta.rowCount} werknemers geladen.</div>}
      {importError && <div style={{ ...s.badgeRed, display: "block", marginTop: 12, borderRadius: 14, padding: 14 }}>{importError}</div>}
    </div>
  );
}

function EmployeeView({ employee, onCreateOrder, importMeta, onLogout }) {
  const s = styles();
  const enriched = calcEmployee(employee);
  const [selectedItem, setSelectedItem] = useState(String(catalog[0].id));
  const [qty, setQty] = useState(1);
  const currentItem = catalog.find((item) => String(item.id) === selectedItem);
  const previewCost = (currentItem?.points || 0) * qty;

  return (
    <div style={s.grid}>
      <div style={{ ...s.card, display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
        <div>
          <div style={s.small}>Werknemer</div>
          <h1 style={{ ...s.title, fontSize: 26 }}>{enriched.fullName}</h1>
          <div style={s.subtitle}>Saldo, historiek en nieuwe bestelling</div>
        </div>
        <button style={s.buttonAlt} onClick={onLogout}>Afmelden</button>
      </div>

      {importMeta && <div style={s.alert}>Gegevens geladen uit <strong>{importMeta.fileName}</strong>. Nieuwe registraties komen erbovenop.</div>}

      <div style={s.statGrid}>
        <div style={s.card}><div style={s.small}>Beschikbaar saldo</div><div style={{ fontSize: 28, fontWeight: 700 }}>{enriched.remaining} punten</div><div style={s.small}>Budget {enriched.budget} • Verbruikt {enriched.spent}</div></div>
        <div style={s.card}><div style={s.small}>Bestellingen</div><div style={{ fontSize: 28, fontWeight: 700 }}>{enriched.orders.length}</div><div style={s.small}>Geïmporteerd + nieuwe registraties</div></div>
        <div style={s.card}><div style={s.small}>Statuut</div><div style={{ fontSize: 28, fontWeight: 700 }}>{enriched.status}</div><div style={s.small}>Extra punten: {enriched.extraPoints}</div></div>
      </div>

      <div style={s.twoCol}>
        <div style={s.card}>
          <h3 style={s.sectionTitle}>Catalogus</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {catalog.map((item) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: 12, border: "1px solid #e2e8f0", borderRadius: 14 }}>
                <span>{item.name}</span>
                <span style={s.badge}>{item.points} pt</span>
              </div>
            ))}
          </div>
        </div>

        <div style={s.card}>
          <h3 style={s.sectionTitle}>Nieuwe bestelling</h3>
          <div style={{ marginBottom: 12 }}>
            <label style={s.small}>Artikel</label>
            <select style={s.input} value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)}>
              {catalog.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.points} pt)</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={s.small}>Aantal</label>
            <input style={s.input} type="number" min="1" value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
          </div>
          <div style={{ background: "#f8fafc", padding: 14, borderRadius: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={s.small}>Kost</span><strong>{previewCost} punten</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}><span style={s.small}>Saldo na bestelling</span><strong>{enriched.remaining - previewCost} punten</strong></div>
          </div>
          <button style={{ ...s.button, width: "100%" }} onClick={() => onCreateOrder(employee.id, Number(selectedItem), qty)}>Bestelling registreren</button>
        </div>
      </div>

      <div style={s.card}>
        <h3 style={s.sectionTitle}>Mijn historiek</h3>
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Datum</th>
                <th style={s.th}>Items</th>
                <th style={s.th}>Status</th>
                <th style={{ ...s.th, textAlign: "right" }}>Punten</th>
              </tr>
            </thead>
            <tbody>
              {enriched.orders.length === 0 ? (
                <tr><td style={s.td} colSpan="4">Nog geen registraties.</td></tr>
              ) : enriched.orders.map((order) => {
                const total = order.items.reduce((sum, line) => sum + getItem(line.itemId).points * line.qty, 0);
                return (
                  <tr key={order.id}>
                    <td style={s.td}>{formatDate(order.date)}</td>
                    <td style={s.td}>{order.items.map((line) => `${getItem(line.itemId)?.name || "Onbekend"} x${line.qty}`).join(", ")}</td>
                    <td style={s.td}>
                      <span style={order.status === "Geweigerd" ? s.badgeRed : order.status === "In aanvraag" ? s.badgeOutline : s.badge}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ ...s.td, textAlign: "right" }}>{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminView({ employees, onAddExtraPoints, onUpdateOrderStatus, importMeta, onImport, importError, onLogout }) {
  const s = styles();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [extraPoints, setExtraPoints] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  const enriched = employees.map(calcEmployee);
  const filtered = enriched.filter((employee) => {
    const matchesSearch = employee.fullName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || employee.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const selectedEmployee = enriched.find((employee) => employee.id === selectedEmployeeId) || null;
  const openRequests = enriched.flatMap((employee) =>
    (employee.orders || [])
      .filter((order) => order.status === "In aanvraag")
      .map((order) => ({ ...order, employeeId: employee.id, employeeName: employee.fullName }))
  );
  const totals = useMemo(() => {
    const totalBudget = enriched.reduce((sum, e) => sum + e.budget, 0);
    const totalSpent = enriched.reduce((sum, e) => sum + e.spent, 0);
    return { employees: enriched.length, totalBudget, totalSpent, totalRemaining: totalBudget - totalSpent };
  }, [employees]);

  return (
    <div style={s.grid}>
      <div style={{ ...s.card, display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
        <div>
          <div style={s.small}>Beheerder</div>
          <h1 style={{ ...s.title, fontSize: 26 }}>Werkkledij Wilms</h1>
          <div style={s.subtitle}>Overzicht, aanvragen en Excel-import</div>
        </div>
        <button style={s.buttonAlt} onClick={onLogout}>Afmelden</button>
      </div>

      {importMeta && <div style={s.alert}>Adminlijst geladen uit <strong>{importMeta.fileName}</strong>. Per werknemer is een beginstand opgebouwd uit Excel.</div>}

      <div style={s.statGrid}>
        <div style={s.card}><div style={s.small}>Werknemers</div><div style={{ fontSize: 28, fontWeight: 700 }}>{totals.employees}</div></div>
        <div style={s.card}><div style={s.small}>Totaal budget</div><div style={{ fontSize: 28, fontWeight: 700 }}>{totals.totalBudget}</div></div>
        <div style={s.card}><div style={s.small}>Verbruikt</div><div style={{ fontSize: 28, fontWeight: 700 }}>{totals.totalSpent}</div></div>
        <div style={s.card}><div style={s.small}>Open aanvragen</div><div style={{ fontSize: 28, fontWeight: 700 }}>{openRequests.length}</div></div>
      </div>

      <ImportPanel onImport={onImport} importMeta={importMeta} importError={importError} />

      <div style={s.card}>
        <h3 style={s.sectionTitle}>Open aanvragen</h3>
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Werknemer</th>
                <th style={s.th}>Datum</th>
                <th style={s.th}>Items</th>
                <th style={s.th}>Punten</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Acties</th>
              </tr>
            </thead>
            <tbody>
              {openRequests.length === 0 ? (
                <tr><td style={s.td} colSpan="6">Geen open aanvragen.</td></tr>
              ) : openRequests.map((order) => {
                const total = order.items.reduce((sum, line) => sum + getItem(line.itemId).points * line.qty, 0);
                return (
                  <tr key={order.id}>
                    <td style={s.td}>{order.employeeName}</td>
                    <td style={s.td}>{formatDate(order.date)}</td>
                    <td style={s.td}>{order.items.map((line) => `${getItem(line.itemId)?.name || "Onbekend"} x${line.qty}`).join(", ")}</td>
                    <td style={s.td}>{total}</td>
                    <td style={s.td}><span style={s.badgeOutline}>In aanvraag</span></td>
                    <td style={s.td}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button style={s.button} onClick={() => onUpdateOrderStatus(order.employeeId, order.id, "Goedgekeurd")}>Goedkeuren</button>
                        <button style={s.buttonAlt} onClick={() => onUpdateOrderStatus(order.employeeId, order.id, "Geweigerd")}>Weigeren</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={s.card}>
        <h3 style={s.sectionTitle}>Overzicht werknemers</h3>
        <div style={{ ...s.nav, marginBottom: 16 }}>
          <input style={{ ...s.input, maxWidth: 320 }} placeholder="Zoek op naam" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select style={{ ...s.input, maxWidth: 220 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Alle statuten</option>
            <option value="Bediende">Bediende</option>
            <option value="Arbeider">Arbeider</option>
          </select>
        </div>
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Naam</th>
                <th style={s.th}>Statuut</th>
                <th style={s.th}>Budget</th>
                <th style={s.th}>Verbruikt</th>
                <th style={s.th}>Resterend</th>
                <th style={s.th}>Actie</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((employee) => (
                <tr key={employee.id}>
                  <td style={s.td}>{employee.fullName}</td>
                  <td style={s.td}>{employee.status}</td>
                  <td style={s.td}>{employee.budget}</td>
                  <td style={s.td}>{employee.spent}</td>
                  <td style={s.td}>
                    <span style={employee.remaining < 0 ? s.badgeRed : s.badge}>{employee.remaining}</span>
                  </td>
                  <td style={s.td}>
                    <button style={s.buttonAlt} onClick={() => setSelectedEmployeeId(employee.id)}>
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedEmployee && (
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}>
            <div>
              <h3 style={s.sectionTitle}>{selectedEmployee.fullName}</h3>
              <div style={s.muted}>Budget {selectedEmployee.budget} • Verbruikt {selectedEmployee.spent} • Resterend {selectedEmployee.remaining}</div>
            </div>
            <button style={s.buttonAlt} onClick={() => setSelectedEmployeeId(null)}>Sluiten</button>
          </div>

          <div style={{ ...s.nav, marginTop: 16, marginBottom: 18 }}>
            <input style={{ ...s.input, maxWidth: 180 }} type="number" placeholder="Extra punten" value={extraPoints} onChange={(e) => setExtraPoints(e.target.value)} />
            <button style={s.button} onClick={() => {
              onAddExtraPoints(selectedEmployee.id, Number(extraPoints) || 0);
              setExtraPoints("");
            }}>Opslaan</button>
          </div>

          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Datum</th>
                  <th style={s.th}>Items</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Punten</th>
                </tr>
              </thead>
              <tbody>
                {selectedEmployee.orders.length === 0 ? (
                  <tr><td style={s.td} colSpan="4">Geen historiek beschikbaar.</td></tr>
                ) : selectedEmployee.orders.map((order) => {
                  const total = order.items.reduce((sum, line) => sum + getItem(line.itemId).points * line.qty, 0);
                  return (
                    <tr key={order.id}>
                      <td style={s.td}>{formatDate(order.date)}</td>
                      <td style={s.td}>{order.items.map((line) => `${getItem(line.itemId)?.name || "Onbekend"} x${line.qty}`).join(", ")}</td>
                      <td style={s.td}>
                        <span style={order.status === "Geweigerd" ? s.badgeRed : order.status === "In aanvraag" ? s.badgeOutline : s.badge}>
                          {order.status}
                        </span>
                      </td>
                      <td style={s.td}>{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
useEffect(() => {
  async function testSupabase() {
    const { data, error } = await supabase
      .from("employees")
      .select("*");

    console.log("SUPABASE DATA:", data);
    console.log("SUPABASE ERROR:", error);
  }

  testSupabase();
}, []);  
  const s = styles();
  const [employees, setEmployees] = useState(initialEmployees);
  const [importMeta, setImportMeta] = useState(null);
  const [importError, setImportError] = useState("");
  const [session, setSession] = useState(null);

  const enrichedEmployees = useMemo(() => employees.map(calcEmployee), [employees]);
  

  function handleImport(parsed, fileName, errorMessage = "") {
    if (errorMessage) {
      setImportError(errorMessage);
      return;
    }
    if (!parsed) return;
    setEmployees(parsed.employees);
    setImportMeta({ fileName, rowCount: parsed.rowCount, importedAt: parsed.importedAt });
    setImportError("");
    if (session?.role === "employee") {
      setSession({ role: "employee", employeeId: String(parsed.employees[0]?.id || "1") });
    }
  }

  function createOrder(employeeId, itemId, qty) {
    setEmployees((current) => current.map((employee) => {
      if (employee.id !== employeeId) return employee;
      const item = getItem(itemId);
      const addedPoints = (item?.points || 0) * qty;
      const currentSpent = employee.importedSpent ?? calcSpent(employee.orders || []);
      const currentRemaining = employee.importedRemaining ?? ((employee.basePoints ?? (employee.status === "Arbeider" ? 300 : 40)) + (employee.extraPoints || 0) - currentSpent);
      return {
        ...employee,
        importedSpent: currentSpent + addedPoints,
        importedRemaining: currentRemaining - addedPoints,
        orders: [{ id: Date.now(), date: new Date().toISOString().slice(0, 10), status: "In aanvraag", items: [{ itemId, qty }] }, ...(employee.orders || [])],
      };
    }));
  }

  function addExtraPoints(employeeId, points) {
    if (!points) return;
    setEmployees((current) => current.map((employee) => {
      if (employee.id !== employeeId) return employee;
      const nextExtra = (employee.extraPoints || 0) + points;
      const basePoints = employee.basePoints ?? (employee.status === "Arbeider" ? 300 : 40);
      const currentSpent = employee.importedSpent ?? calcSpent(employee.orders || []);
      return { ...employee, extraPoints: nextExtra, importedRemaining: basePoints + nextExtra - currentSpent };
    }));
  }

  function updateOrderStatus(employeeId, orderId, newStatus) {
    setEmployees((current) => current.map((employee) => {
      if (employee.id !== employeeId) return employee;
      return {
        ...employee,
        orders: (employee.orders || []).map((order) => order.id === orderId ? { ...order, status: newStatus } : order),
      };
    }));
  }

  if (!session) {
  return <LoginScreen employees={enrichedEmployees} onLogin={(role, employeeId) => setSession({ role, employeeId })} />;
}

return (
  <div style={s.page}>
    <div style={s.container}>
      <AdminView
        employees={employees}
        onAddExtraPoints={addExtraPoints}
        onUpdateOrderStatus={updateOrderStatus}
        importMeta={importMeta}
        onImport={handleImport}
        importError={importError}
        onLogout={() => setSession(null)}
      />
    </div>
  </div>
);
}
