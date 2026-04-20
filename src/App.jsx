import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import * as XLSX from "xlsx";

const initialCatalog = [
  { id: 1, name: "Blauwe vest", points: 40, active: true, excelHeader: "Blauwe vest - 40" },
  { id: 2, name: "Bodywarmer", points: 40, active: true, excelHeader: "Bodywarmer - 40" },
  { id: 3, name: "Broek (lang)", points: 70, active: true, excelHeader: "Broek (lang) - 70" },
  { id: 4, name: "Fleece", points: 20, active: true, excelHeader: "Fleece - 20" },
  { id: 5, name: "Jas", points: 80, active: true, excelHeader: "Jas - 80" },
  { id: 6, name: "Korte short", points: 80, active: true, excelHeader: "Korte short - 80" },
  { id: 7, name: "Lange short", points: 50, active: true, excelHeader: "Lange short - 50" },
  { id: 8, name: "Polo", points: 0, active: true, excelHeader: "Polo - 0" },
  { id: 9, name: "Schoenen", points: 70, active: true, excelHeader: "Schoenen - 70" },
  { id: 10, name: "Sokken (1 paar)", points: 10, active: true, excelHeader: "Sokken (1 paar) - 10" },
  { id: 11, name: "Sweater", points: 20, active: true, excelHeader: "Sweater - 20" },
  { id: 12, name: "T-shirt", points: 0, active: true, excelHeader: "T-shirt - 0" }
];

const initialEmployees = [
  { id: 1, firstName: "Mark", lastName: "Meeus", fullName: "Meeus Mark", status: "Bediende", active: true, basePoints: 40, extraPoints: 20, importedSpent: null, importedRemaining: null, orders: [] },
  { id: 2, firstName: "An", lastName: "Peeters", fullName: "Peeters An", status: "Arbeider", active: true, basePoints: 300, extraPoints: 0, importedSpent: null, importedRemaining: null, orders: [] },
  { id: 3, firstName: "Tom", lastName: "Janssens", fullName: "Janssens Tom", status: "Arbeider", active: true, basePoints: 300, extraPoints: 30, importedSpent: null, importedRemaining: null, orders: [] },
  { id: 4, firstName: "Els", lastName: "Vermeulen", fullName: "Vermeulen Els", status: "Bediende", active: true, basePoints: 40, extraPoints: 10, importedSpent: null, importedRemaining: null, orders: [] }
];

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const normalized = String(value).replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString("nl-BE");
}

function styles() {
  return {
    page: { minHeight: "100vh", background: "#f1f5f9", color: "#0f172a" },
    container: { maxWidth: 1280, margin: "0 auto", padding: 16, display: "grid", gap: 16 },
    card: { background: "#fff", borderRadius: 20, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
    grid: { display: "grid", gap: 16 },
    statGrid: { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" },
    twoCol: { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" },
    input: { width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid #cbd5e1", fontSize: 14, background: "#fff" },
    button: { padding: "12px 16px", borderRadius: 14, border: "none", background: "#0f172a", color: "#fff", cursor: "pointer", fontWeight: 600 },
    buttonAlt: { padding: "10px 14px", borderRadius: 14, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" },
    buttonDanger: { padding: "10px 14px", borderRadius: 14, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", cursor: "pointer" },
    badge: { display: "inline-block", padding: "5px 10px", borderRadius: 999, background: "#e2e8f0", fontSize: 12 },
    badgeRed: { display: "inline-block", padding: "5px 10px", borderRadius: 999, background: "#fee2e2", color: "#991b1b", fontSize: 12 },
    badgeGreen: { display: "inline-block", padding: "5px 10px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: 12 },
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
    alert: { background: "#eff6ff", color: "#1d4ed8", padding: 14, borderRadius: 14, border: "1px solid #bfdbfe" }
  };
}

function calcSpent(orders, catalogItems) {
  return (orders || []).reduce((total, order) => {
    const orderTotal = (order.items || []).reduce((sum, line) => {
      const item = catalogItems.find((x) => x.id === line.itemId);
      return sum + (item?.points || line.pointsPerUnit || 0) * line.qty;
    }, 0);
    return total + orderTotal;
  }, 0);
}

function calcEmployee(employee, catalogItems) {
  const basePoints = employee.basePoints ?? (employee.status === "Arbeider" ? 300 : 40);
  const budgetRaw = basePoints + (employee.extraPoints || 0);
  const budget = Math.min(500, budgetRaw);
  const calculatedSpent = calcSpent(employee.orders || [], catalogItems);
  const spent = employee.importedSpent ?? calculatedSpent;
  const remaining = employee.importedRemaining ?? (budget - spent);
  return { ...employee, basePoints, budget, spent, remaining };
}

function buildImportedOrderLines(row, catalogItems) {
  return catalogItems.map((item) => ({ itemId: item.id, qty: toNumber(row[item.excelHeader]) })).filter((line) => line.qty > 0);
}

function parseEmployeesFromWorkbook(fileBuffer, catalogItems) {
  const workbook = XLSX.read(fileBuffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets["INVOER"];
  if (!sheet) throw new Error("Het werkblad 'INVOER' werd niet gevonden.");
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const importedEmployees = rows.filter((row) => row["Achternaam"] || row["Voornaam"]).map((row, index) => {
    const status = row["Statuut"] || "Bediende";
    const extraPoints = toNumber(row["EXTRA punten"]);
    const basePoints = status === "Arbeider" ? 300 : 40;
    const importedSpent = row["Verbruikt"] === "" ? null : toNumber(row["Verbruikt"]);
    const importedRemaining = row["Resterend"] === "" ? null : toNumber(row["Resterend"]);
    const items = buildImportedOrderLines(row, catalogItems);
    return {
      id: index + 1,
      firstName: String(row["Voornaam"] || "").trim(),
      lastName: String(row["Achternaam"] || "").trim(),
      fullName: String(row["Naam + Voornaam"] || `${row["Achternaam"] || ""} ${row["Voornaam"] || ""}`).trim(),
      status,
      active: true,
      basePoints,
      extraPoints,
      importedSpent,
      importedRemaining,
      orders: items.length ? [{ id: Number(`9${index + 1}`), date: "2026-01-01", status: "Geïmporteerd uit Excel", items }] : []
    };
  });

  return { employees: importedEmployees, importedAt: new Date().toISOString(), rowCount: importedEmployees.length };
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
      onImport(buffer, file.name);
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

function AdminView({ employees, catalogItems, importMeta, importError, onImport, onAddEmployee, onDeactivateEmployee, onAddExtraPoints, onSaveOrder, onAddCatalogItem }) {
  const s = styles();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [extraPoints, setExtraPoints] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newStatus, setNewStatus] = useState("Bediende");
  const [articleId, setArticleId] = useState(String(catalogItems.find((x) => x.active)?.id || ""));
  const [articleQty, setArticleQty] = useState(1);
  const [cart, setCart] = useState([]);
  const [newArticleName, setNewArticleName] = useState("");
  const [newArticlePoints, setNewArticlePoints] = useState("");

  const enriched = employees.map((employee) => calcEmployee(employee, catalogItems));
  const filtered = enriched.filter((employee) => {
    const matchesSearch = employee.fullName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || employee.status === statusFilter;
    return employee.active && matchesSearch && matchesStatus;
  });
  const selectedEmployee = enriched.find((employee) => employee.id === selectedEmployeeId) || null;

  const totals = useMemo(() => {
    const activeEmployees = enriched.filter((x) => x.active);
    const totalBudget = activeEmployees.reduce((sum, e) => sum + e.budget, 0);
    const totalSpent = activeEmployees.reduce((sum, e) => sum + e.spent, 0);
    const totalOrders = activeEmployees.reduce((sum, e) => sum + (e.orders?.length || 0), 0);
    return { employees: activeEmployees.length, totalBudget, totalSpent, totalOrders };
  }, [employees, catalogItems]);

  function addLineToCart() {
    const chosen = catalogItems.find((item) => String(item.id) === articleId);
    if (!chosen) return;
    setCart((current) => [...current, { itemId: chosen.id, qty: articleQty, pointsPerUnit: chosen.points }]);
    setArticleQty(1);
  }

  const totalCartPoints = cart.reduce((sum, line) => sum + line.qty * line.pointsPerUnit, 0);

  return (
    <div style={s.grid}>
      <div style={{ ...s.card, display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
        <div>
          <div style={s.small}>Beheerder</div>
          <h1 style={{ ...s.title, fontSize: 26 }}>Werkkledij Wilms</h1>
          <div style={s.subtitle}>Overzicht, werknemers, artikelen, bestellingen en Excel-import</div>
        </div>
      </div>

      <div style={s.statGrid}>
        <div style={s.card}><div style={s.small}>Werknemers</div><div style={{ fontSize: 28, fontWeight: 700 }}>{totals.employees}</div></div>
        <div style={s.card}><div style={s.small}>Totaal budget</div><div style={{ fontSize: 28, fontWeight: 700 }}>{totals.totalBudget}</div></div>
        <div style={s.card}><div style={s.small}>Verbruikt</div><div style={{ fontSize: 28, fontWeight: 700 }}>{totals.totalSpent}</div></div>
        <div style={s.card}><div style={s.small}>Bestellingen</div><div style={{ fontSize: 28, fontWeight: 700 }}>{totals.totalOrders}</div></div>
      </div>

      <ImportPanel onImport={onImport} importMeta={importMeta} importError={importError} />

      <div style={s.twoCol}>
        <div style={s.card}>
          <h3 style={s.sectionTitle}>Nieuwe werknemer</h3>
          <div style={s.grid}>
            <input style={s.input} placeholder="Voornaam" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
            <input style={s.input} placeholder="Achternaam" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
            <select style={s.input} value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              <option value="Bediende">Bediende</option>
              <option value="Arbeider">Arbeider</option>
            </select>
            <button style={s.button} onClick={() => { onAddEmployee(newFirstName, newLastName, newStatus); setNewFirstName(""); setNewLastName(""); setNewStatus("Bediende"); }}>
              Werknemer toevoegen
            </button>
          </div>
        </div>

        <div style={s.card}>
          <h3 style={s.sectionTitle}>Nieuw artikel</h3>
          <div style={s.grid}>
            <input style={s.input} placeholder="Artikelnaam" value={newArticleName} onChange={(e) => setNewArticleName(e.target.value)} />
            <input style={s.input} placeholder="Punten" type="number" value={newArticlePoints} onChange={(e) => setNewArticlePoints(e.target.value)} />
            <button style={s.button} onClick={() => { onAddCatalogItem(newArticleName, Number(newArticlePoints) || 0); setNewArticleName(""); setNewArticlePoints(""); }}>
              Artikel toevoegen
            </button>
          </div>
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
                  <td style={s.td}><span style={employee.remaining < 0 ? s.badgeRed : s.badge}>{employee.remaining}</span></td>
                  <td style={s.td}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button style={s.buttonAlt} onClick={() => { setSelectedEmployeeId(employee.id); setCart([]); }}>Details</button>
                      <button style={s.buttonDanger} onClick={() => onDeactivateEmployee(employee.id)}>Inactief zetten</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td style={s.td} colSpan="6">Geen werknemers gevonden.</td></tr>}
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

          <div style={{ ...s.twoCol, marginTop: 12 }}>
            <div style={s.card}>
              <h4 style={{ marginTop: 0 }}>Extra punten</h4>
              <div style={{ ...s.nav }}>
                <input style={{ ...s.input, maxWidth: 180 }} type="number" placeholder="Extra punten" value={extraPoints} onChange={(e) => setExtraPoints(e.target.value)} />
                <button style={s.button} onClick={() => { onAddExtraPoints(selectedEmployee.id, Number(extraPoints) || 0); setExtraPoints(""); }}>Opslaan</button>
              </div>
            </div>

            <div style={s.card}>
              <h4 style={{ marginTop: 0 }}>Nieuwe bestelling</h4>
              <div style={s.grid}>
                <select style={s.input} value={articleId} onChange={(e) => setArticleId(e.target.value)}>
                  {catalogItems.filter((item) => item.active).map((item) => (
                    <option key={item.id} value={item.id}>{item.name} ({item.points} pt)</option>
                  ))}
                </select>
                <input style={s.input} type="number" min="1" value={articleQty} onChange={(e) => setArticleQty(Number(e.target.value) || 1)} />
                <button style={s.buttonAlt} onClick={addLineToCart}>Artikel toevoegen</button>
              </div>

              <div style={{ marginTop: 16 }}>
                {cart.length === 0 ? <div style={s.small}>Nog geen artikels gekozen.</div> : (
                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead><tr><th style={s.th}>Artikel</th><th style={s.th}>Aantal</th><th style={s.th}>Punten</th></tr></thead>
                      <tbody>
                        {cart.map((line, idx) => {
                          const item = catalogItems.find((x) => x.id === line.itemId);
                          return <tr key={`${line.itemId}-${idx}`}><td style={s.td}>{item?.name || "Onbekend"}</td><td style={s.td}>{line.qty}</td><td style={s.td}>{line.qty * line.pointsPerUnit}</td></tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ marginTop: 12, ...s.small }}>Totaal bestelling: <strong>{totalCartPoints}</strong> punten</div>
                <div style={{ marginTop: 6, ...s.small }}>Saldo na bestelling: <strong>{selectedEmployee.remaining - totalCartPoints}</strong> punten</div>
                <button style={{ ...s.button, marginTop: 12 }} onClick={() => { onSaveOrder(selectedEmployee.id, cart); setCart([]); }} disabled={cart.length === 0}>
                  Bestelling opslaan
                </button>
              </div>
            </div>
          </div>

          <div style={{ ...s.tableWrap, marginTop: 18 }}>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Datum</th><th style={s.th}>Items</th><th style={s.th}>Status</th><th style={s.th}>Punten</th></tr></thead>
              <tbody>
                {selectedEmployee.orders.length === 0 ? <tr><td style={s.td} colSpan="4">Geen historiek beschikbaar.</td></tr> : selectedEmployee.orders.map((order) => {
                  const total = order.items.reduce((sum, line) => {
                    const item = catalogItems.find((x) => x.id === line.itemId);
                    return sum + (item?.points || line.pointsPerUnit || 0) * line.qty;
                  }, 0);
                  return <tr key={order.id}><td style={s.td}>{formatDate(order.date)}</td><td style={s.td}>{order.items.map((line) => {
                    const item = catalogItems.find((x) => x.id === line.itemId);
                    return `${item?.name || "Onbekend"} x${line.qty}`;
                  }).join(", ")}</td><td style={s.td}><span style={order.status === "Geleverd" ? s.badgeGreen : s.badge}>{order.status}</span></td><td style={s.td}>{total}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={s.card}>
        <h3 style={s.sectionTitle}>Artikellijst</h3>
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead><tr><th style={s.th}>Artikel</th><th style={s.th}>Punten</th><th style={s.th}>Status</th></tr></thead>
            <tbody>
              {catalogItems.map((item) => <tr key={item.id}><td style={s.td}>{item.name}</td><td style={s.td}>{item.points}</td><td style={s.td}><span style={item.active ? s.badgeGreen : s.badgeRed}>{item.active ? "Actief" : "Inactief"}</span></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
  async function loadEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.log("LOAD EMPLOYEES ERROR:", error);
      return;
    }

    const mapped = (data || []).map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: row.full_name,
      email: row.email,
      status: row.status,
      active: row.active,
      basePoints: row.status === "Arbeider" ? 300 : 40,
      extraPoints: row.extra_points || 0,
      importedSpent: null,
      importedRemaining: null,
      orders: []
    }));

    setEmployees(mapped);
  }

  loadEmployees();
}, []);
    async function testSupabase() {
      const { data, error } = await supabase.from("employees").select("*");
      console.log("SUPABASE DATA:", data);
      console.log("SUPABASE ERROR:", error);
    }
    testSupabase();
  }, []);

  const s = styles();
  const [employees, setEmployees] = useState([]);
  const [catalogItems, setCatalogItems] = useState(initialCatalog);
  const [importMeta, setImportMeta] = useState(null);
  const [importError, setImportError] = useState("");

  async function handleImport(fileBuffer, fileName) {
    try {
      const parsed = parseEmployeesFromWorkbook(fileBuffer, catalogItems);
      setEmployees(parsed.employees);
      setImportMeta({ fileName, rowCount: parsed.rowCount, importedAt: parsed.importedAt });
      setImportError("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import mislukt.");
    }
  }

  function onAddEmployee(firstName, lastName, status) {
    if (!firstName || !lastName) return;
    setEmployees((current) => [...current, {
      id: Date.now(),
      firstName, lastName, fullName: `${lastName} ${firstName}`.trim(),
      status, active: true, basePoints: status === "Arbeider" ? 300 : 40,
      extraPoints: 0, importedSpent: null, importedRemaining: null, orders: []
    }]);
  }

  function onDeactivateEmployee(employeeId) {
    setEmployees((current) => current.map((employee) => employee.id === employeeId ? { ...employee, active: false } : employee));
  }

  function onAddExtraPoints(employeeId, points) {
    if (!points) return;
    setEmployees((current) => current.map((employee) => employee.id === employeeId ? { ...employee, extraPoints: (employee.extraPoints || 0) + points } : employee));
  }

  function onSaveOrder(employeeId, cart) {
    if (!cart || cart.length === 0) return;
    setEmployees((current) => current.map((employee) => employee.id === employeeId ? {
      ...employee,
      orders: [{ id: Date.now(), date: new Date().toISOString().slice(0, 10), status: "Besteld", items: cart }, ...(employee.orders || [])]
    } : employee));
  }

  function onAddCatalogItem(name, points) {
    if (!name) return;
    setCatalogItems((current) => [...current, { id: Date.now(), name, points, active: true, excelHeader: name }]);
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <AdminView
          employees={employees}
          catalogItems={catalogItems}
          importMeta={importMeta}
          importError={importError}
          onImport={handleImport}
          onAddEmployee={onAddEmployee}
          onDeactivateEmployee={onDeactivateEmployee}
          onAddExtraPoints={onAddExtraPoints}
          onSaveOrder={onSaveOrder}
          onAddCatalogItem={onAddCatalogItem}
        />
      </div>
    </div>
  );
}
