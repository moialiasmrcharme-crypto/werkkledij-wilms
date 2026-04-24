import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

const COLORS = {
  navy: "#1f2a44",
  navy2: "#2d3f63",
  yellow: "#f2c300",
  yellowSoft: "#fff6cc",
  bg: "#f5f7fb",
  card: "#ffffff",
  border: "#d9dee8",
  text: "#1c2434",
  muted: "#667085",
  dangerBg: "#fee2e2",
  dangerText: "#991b1b",
  infoBg: "#eef4ff",
  infoText: "#1d4ed8",
  successBg: "#ecfdf3",
  successText: "#166534",
};

export default function App() {
  const [employees, setEmployees] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [ordersByEmployee, setOrdersByEmployee] = useState({});

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showNewEmployee, setShowNewEmployee] = useState(true);
  const [showNewOrder, setShowNewOrder] = useState(true);
  const [showEmployees, setShowEmployees] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showStock, setShowStock] = useState(true);
  const [showOrders, setShowOrders] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employeeStatus, setEmployeeStatus] = useState("Arbeider");
  const [extraPointsInput, setExtraPointsInput] = useState("");

  const [newItemName, setNewItemName] = useState("");
  const [newItemPoints, setNewItemPoints] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("active");

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [selectedStockId, setSelectedStockId] = useState("");
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState([]);

  const [detailEmployeeId, setDetailEmployeeId] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setErrorMessage("");

    const [employeesResult, catalogResult, stockResult, ordersResult, linesResult] =
      await Promise.all([
        supabase.from("employees").select("*").order("full_name", { ascending: true }),
        supabase.from("catalog_items").select("*").order("name", { ascending: true }),
        supabase.from("stock_items").select("*").order("item_name", { ascending: true }),
        supabase.from("orders").select("*").order("id", { ascending: false }),
        supabase.from("order_lines").select("*").order("id", { ascending: true }),
      ]);

    setLoading(false);

    if (employeesResult.error) return showError("Werknemers konden niet geladen worden.", employeesResult.error);
    if (catalogResult.error) return showError("Catalogus kon niet geladen worden.", catalogResult.error);
    if (stockResult.error) return showError("Voorraad kon niet geladen worden.", stockResult.error);
    if (ordersResult.error) return showError("Bestellingen konden niet geladen worden.", ordersResult.error);
    if (linesResult.error) return showError("Bestellijnen konden niet geladen worden.", linesResult.error);

    const grouped = {};
    (ordersResult.data || []).forEach((order) => {
      if (!grouped[order.employee_id]) grouped[order.employee_id] = [];
      grouped[order.employee_id].push({
        ...order,
        lines: (linesResult.data || []).filter((line) => line.order_id === order.id),
      });
    });

    setEmployees(employeesResult.data || []);
    setCatalogItems(catalogResult.data || []);
    setStockItems(stockResult.data || []);
    setOrdersByEmployee(grouped);
  }

  function showError(message, error) {
    console.log(message, error);
    setErrorMessage(message);
  }

  function clearMessages() {
    setErrorMessage("");
    setSuccessMessage("");
  }

  const activeCatalogItems = useMemo(
    () => catalogItems.filter((item) => item.active),
    [catalogItems]
  );

  const selectedCatalogItem = useMemo(() => {
    return catalogItems.find((item) => String(item.id) === String(selectedCatalogId)) || null;
  }, [catalogItems, selectedCatalogId]);

  const availableStockForSelectedArticle = useMemo(() => {
    if (!selectedCatalogItem) return [];
    return stockItems
      .filter(
        (stock) =>
          stock.active &&
          stock.item_name === selectedCatalogItem.name &&
          Number(stock.quantity || 0) > 0
      )
      .sort((a, b) => {
        const sizeCompare = String(a.size || "").localeCompare(String(b.size || ""), "nl-BE");
        if (sizeCompare !== 0) return sizeCompare;
        return String(a.variant || "").localeCompare(String(b.variant || ""), "nl-BE");
      });
  }, [selectedCatalogItem, stockItems]);

  const lowStockItems = useMemo(() => {
    return stockItems
      .filter(
        (stock) =>
          stock.active &&
          Number(stock.quantity || 0) <= Number(stock.minimum_quantity || 2)
      )
      .sort((a, b) => String(a.item_name || "").localeCompare(String(b.item_name || ""), "nl-BE"));
  }, [stockItems]);

  const employeesWithStats = useMemo(() => {
    return employees.map((employee) => {
      const basePoints = employee.status === "Arbeider" ? 300 : 40;
      const extraPoints = Number(employee.extra_points || 0);
      const budget = Math.min(500, basePoints + extraPoints);
      const orders = ordersByEmployee[employee.id] || [];
      const orderedPoints = orders.reduce((sum, order) => {
        if (order.status === "Geannuleerd") return sum;
        const orderTotal = (order.lines || []).reduce((lineSum, line) => {
          return lineSum + Number(line.qty || 0) * Number(line.points_per_unit || 0);
        }, 0);
        return sum + orderTotal;
      }, 0);
      const openingSpent = Number(employee.opening_spent || 0);
      const spent = openingSpent + orderedPoints;
      return { ...employee, budget, spent, remaining: budget - spent };
    });
  }, [employees, ordersByEmployee]);

  const filteredEmployees = useMemo(() => {
    let result = [...employeesWithStats];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter((employee) =>
        String(employee.full_name || "").toLowerCase().includes(term)
      );
    }
    if (statusFilter !== "all") result = result.filter((employee) => employee.status === statusFilter);
    if (activeFilter === "active") result = result.filter((employee) => employee.active);
    if (activeFilter === "inactive") result = result.filter((employee) => !employee.active);
    return result.sort((a, b) =>
      String(a.full_name || "").localeCompare(String(b.full_name || ""), "nl-BE")
    );
  }, [employeesWithStats, searchTerm, statusFilter, activeFilter]);

  const selectedOrderEmployee = useMemo(() => {
    return employeesWithStats.find((employee) => String(employee.id) === String(selectedEmployeeId)) || null;
  }, [employeesWithStats, selectedEmployeeId]);

  const detailEmployee = useMemo(() => {
    return employeesWithStats.find((employee) => String(employee.id) === String(detailEmployeeId)) || null;
  }, [employeesWithStats, detailEmployeeId]);

  const currentOrderTotal = useMemo(() => {
    return cart.reduce((sum, line) => {
      return sum + Number(line.qty || 0) * Number(line.points_per_unit || 0);
    }, 0);
  }, [cart]);

  const projectedRemaining = useMemo(() => {
    if (!selectedOrderEmployee) return null;
    return selectedOrderEmployee.remaining - currentOrderTotal;
  }, [selectedOrderEmployee, currentOrderTotal]);

  const stats = useMemo(() => {
    const activeEmployees = employeesWithStats.filter((employee) => employee.active);
    return {
      activeEmployees: activeEmployees.length,
      totalBudget: activeEmployees.reduce((sum, employee) => sum + employee.budget, 0),
      totalSpent: activeEmployees.reduce((sum, employee) => sum + employee.spent, 0),
      totalRemaining: activeEmployees.reduce((sum, employee) => sum + employee.remaining, 0),
      totalOrders: Object.values(ordersByEmployee).reduce((sum, orders) => sum + orders.length, 0),
      lowStock: lowStockItems.length,
    };
  }, [employeesWithStats, ordersByEmployee, lowStockItems]);

  async function onAddEmployee() {
    clearMessages();
    if (!firstName.trim() || !lastName.trim()) return setErrorMessage("Voornaam en achternaam zijn verplicht.");
    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: `${lastName.trim()} ${firstName.trim()}`,
      email: "",
      status: employeeStatus,
      active: true,
      extra_points: 0,
      opening_spent: 0,
    };
    const { data, error } = await supabase.from("employees").insert([payload]).select();
    if (error) return showError("Werknemer kon niet toegevoegd worden.", error);
    setEmployees((prev) => [...prev, ...(data || [])].sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || ""), "nl-BE")));
    setFirstName("");
    setLastName("");
    setEmployeeStatus("Arbeider");
    setShowEmployees(true);
    setSuccessMessage("Werknemer toegevoegd.");
  }

  async function onToggleEmployee(employee) {
    clearMessages();
    const nextActive = !employee.active;
    const { error } = await supabase.from("employees").update({ active: nextActive }).eq("id", employee.id);
    if (error) return showError("Werknemerstatus kon niet aangepast worden.", error);
    setEmployees((prev) => prev.map((item) => (item.id === employee.id ? { ...item, active: nextActive } : item)));
  }

  async function onAddExtraPoints() {
    clearMessages();
    if (!detailEmployee) return;
    const points = Number(extraPointsInput);
    if (!Number.isFinite(points) || points === 0) return setErrorMessage("Vul een geldig aantal extra punten in.");
    const newExtraPoints = Number(detailEmployee.extra_points || 0) + points;
    const { error } = await supabase.from("employees").update({ extra_points: newExtraPoints }).eq("id", detailEmployee.id);
    if (error) return showError("Extra punten konden niet opgeslagen worden.", error);
    setEmployees((prev) => prev.map((employee) => employee.id === detailEmployee.id ? { ...employee, extra_points: newExtraPoints } : employee));
    setExtraPointsInput("");
    setSuccessMessage("Extra punten opgeslagen.");
  }

  async function onAddCatalogItem() {
    clearMessages();
    if (!newItemName.trim()) return setErrorMessage("Artikelnaam is verplicht.");
    const payload = { name: newItemName.trim(), points: Number(newItemPoints || 0), active: true };
    const { data, error } = await supabase.from("catalog_items").insert([payload]).select();
    if (error) return showError("Artikel kon niet toegevoegd worden.", error);
    setCatalogItems((prev) => [...prev, ...(data || [])]);
    setNewItemName("");
    setNewItemPoints("");
    setShowCatalog(true);
    setSuccessMessage("Artikel toegevoegd.");
  }

  async function onToggleCatalogItem(item) {
    clearMessages();
    const nextActive = !item.active;
    const { error } = await supabase.from("catalog_items").update({ active: nextActive }).eq("id", item.id);
    if (error) return showError("Artikelstatus kon niet aangepast worden.", error);
    setCatalogItems((prev) => prev.map((catalogItem) => catalogItem.id === item.id ? { ...catalogItem, active: nextActive } : catalogItem));
  }

  async function onToggleStockItem(item) {
    clearMessages();
    const nextActive = !item.active;
    const { error } = await supabase.from("stock_items").update({ active: nextActive }).eq("id", item.id);
    if (error) return showError("Voorraadregel kon niet aangepast worden.", error);
    setStockItems((prev) => prev.map((stock) => stock.id === item.id ? { ...stock, active: nextActive } : stock));
  }

  async function onChangeStockQuantity(item, delta) {
    clearMessages();
    const nextQuantity = Math.max(0, Number(item.quantity || 0) + delta);
    const { error } = await supabase.from("stock_items").update({ quantity: nextQuantity }).eq("id", item.id);
    if (error) return showError("Voorraad kon niet aangepast worden.", error);
    setStockItems((prev) => prev.map((stock) => stock.id === item.id ? { ...stock, quantity: nextQuantity } : stock));
  }

  function onAddLineToCart() {
    clearMessages();
    if (!selectedCatalogItem) return setErrorMessage("Kies eerst een artikel.");
    const stock = stockItems.find((item) => String(item.id) === String(selectedStockId));
    if (!stock) return setErrorMessage("Kies eerst een maat.");
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) return setErrorMessage("Aantal moet groter zijn dan 0.");
    const alreadyInCart = cart.filter((line) => line.stock_item_id === stock.id).reduce((sum, line) => sum + Number(line.qty || 0), 0);
    if (Number(stock.quantity || 0) < alreadyInCart + quantity) return setErrorMessage("Onvoldoende voorraad voor deze maat.");
    setCart((prev) => [...prev, {
      tempId: Date.now() + Math.random(),
      item_id: selectedCatalogItem.id,
      item_name: selectedCatalogItem.name,
      stock_item_id: stock.id,
      size: stock.size,
      variant: stock.variant || "",
      qty: quantity,
      points_per_unit: Number(selectedCatalogItem.points || 0),
    }]);
    setSelectedCatalogId("");
    setSelectedStockId("");
    setQty(1);
  }

  function onRemoveCartLine(tempId) {
    setCart((prev) => prev.filter((line) => line.tempId !== tempId));
  }

  async function onCreateOrder() {
    clearMessages();
    if (!selectedEmployeeId) return setErrorMessage("Kies eerst een werknemer.");
    if (cart.length === 0) return setErrorMessage("Voeg eerst minstens één artikel toe.");
    for (const line of cart) {
      const stock = stockItems.find((item) => item.id === line.stock_item_id);
      if (!stock || Number(stock.quantity || 0) < Number(line.qty || 0)) return setErrorMessage(`Onvoldoende voorraad voor ${line.item_name} maat ${line.size}.`);
    }
    const employeeId = Number(selectedEmployeeId);
    const { data: orderData, error: orderError } = await supabase.from("orders").insert([{ employee_id: employeeId, order_date: new Date().toISOString().slice(0, 10), status: "Besteld", note: "" }]).select();
    if (orderError) return showError("Bestelling kon niet opgeslagen worden.", orderError);
    const order = orderData?.[0];
    if (!order) return setErrorMessage("Bestelling werd niet correct aangemaakt.");
    const linePayload = cart.map((line) => ({ order_id: order.id, item_id: Number(line.item_id), stock_item_id: Number(line.stock_item_id), size: line.size, variant: line.variant || "", qty: Number(line.qty), points_per_unit: Number(line.points_per_unit) }));
    const { data: lineData, error: lineError } = await supabase.from("order_lines").insert(linePayload).select();
    if (lineError) {
      await supabase.from("orders").delete().eq("id", order.id);
      return showError("Bestellijnen konden niet opgeslagen worden.", lineError);
    }
    for (const line of cart) {
      const stock = stockItems.find((item) => item.id === line.stock_item_id);
      const nextQuantity = Number(stock.quantity || 0) - Number(line.qty || 0);
      const { error: stockError } = await supabase.from("stock_items").update({ quantity: nextQuantity }).eq("id", line.stock_item_id);
      if (stockError) {
        await loadAll();
        return showError("Bestelling is opgeslagen, maar voorraad kon niet volledig aangepast worden.", stockError);
      }
    }
    setSelectedEmployeeId("");
    setSelectedCatalogId("");
    setSelectedStockId("");
    setQty(1);
    setCart([]);
    setShowOrders(true);
    setSuccessMessage("Bestelling opgeslagen en voorraad aangepast.");
    await loadAll();
  }

  async function onDeleteOrder(order) {
    clearMessages();
    const { error: lineError } = await supabase.from("order_lines").delete().eq("order_id", order.id);
    if (lineError) return showError("Bestellijnen konden niet verwijderd worden.", lineError);
    const { error: orderError } = await supabase.from("orders").delete().eq("id", order.id);
    if (orderError) return showError("Bestelling kon niet verwijderd worden.", orderError);
    for (const line of order.lines || []) {
      if (!line.stock_item_id) continue;
      const stock = stockItems.find((item) => item.id === line.stock_item_id);
      if (!stock) continue;
      await supabase.from("stock_items").update({ quantity: Number(stock.quantity || 0) + Number(line.qty || 0) }).eq("id", line.stock_item_id);
    }
    await loadAll();
    setSuccessMessage("Bestelling verwijderd en voorraad teruggezet.");
  }

  function getItemName(itemId) {
    const catalogItem = catalogItems.find((item) => item.id === itemId);
    return catalogItem ? catalogItem.name : `Artikel ${itemId}`;
  }

  function lineLabel(line) {
    const name = getItemName(line.item_id);
    const size = line.size ? `maat ${line.size}` : "geen maat";
    const variant = line.variant ? ` - ${line.variant}` : "";
    return `${name} - ${size}${variant}`;
  }

  function exportEmployeesCsv() {
    const rows = employeesWithStats.map((employee) => ({ naam: employee.full_name || "", statuut: employee.status || "", actief: employee.active ? "ja" : "nee", extra_punten: employee.extra_points || 0, historisch_verbruikt: employee.opening_spent || 0, budget: employee.budget || 0, verbruikt: employee.spent || 0, saldo: employee.remaining || 0 }));
    downloadCsv("werknemers_export.csv", rows);
  }

  function exportStockCsv() {
    const rows = stockItems.map((stock) => ({ artikel: stock.item_name || "", variant: stock.variant || "", maat: stock.size || "", voorraad: stock.quantity || 0, minimum: stock.minimum_quantity || 0, actief: stock.active ? "ja" : "nee", lage_stock: Number(stock.quantity || 0) <= Number(stock.minimum_quantity || 2) ? "ja" : "nee" }));
    downloadCsv("voorraad_export.csv", rows);
  }

  function exportOrdersCsv() {
    const rows = [];
    employeesWithStats.forEach((employee) => {
      const orders = ordersByEmployee[employee.id] || [];
      orders.forEach((order) => {
        (order.lines || []).forEach((line) => {
          rows.push({ werknemer: employee.full_name || "", datum: order.order_date || "", status: order.status || "", artikel: getItemName(line.item_id), maat: line.size || "", variant: line.variant || "", aantal: line.qty || 0, punten_per_stuk: line.points_per_unit || 0, totaal: Number(line.qty || 0) * Number(line.points_per_unit || 0) });
        });
      });
    });
    downloadCsv("bestellingen_export.csv", rows);
  }

  function downloadCsv(filename, rows) {
    if (!rows || rows.length === 0) return setErrorMessage("Er is geen data om te exporteren.");
    const headers = Object.keys(rows[0]);
    const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.map(escapeCell).join(";"), ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function blockStyle() {
    return { border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 16, marginBottom: 20, background: COLORS.card, boxShadow: "0 2px 10px rgba(16,24,40,0.05)" };
  }

  function inputStyle() {
    return { display: "block", width: "100%", padding: 11, marginTop: 4, borderRadius: 10, border: `1px solid ${COLORS.border}`, fontSize: 14 };
  }

  function primaryButtonStyle(disabled = false) {
    return { background: disabled ? "#c9ced8" : COLORS.navy, color: "#fff", border: "none", borderRadius: 10, padding: "10px 14px", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" };
  }

  function secondaryButtonStyle() {
    return { background: "#fff", color: COLORS.navy, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 14px", fontWeight: 600, cursor: "pointer" };
  }

  function dangerButtonStyle() {
    return { background: "#fff", color: COLORS.dangerText, border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontWeight: 600, cursor: "pointer" };
  }

  function stockStyle(stock) {
    const quantity = Number(stock.quantity || 0);
    const minimum = Number(stock.minimum_quantity || 2);
    if (quantity <= 0) return { color: COLORS.dangerText, fontWeight: 800 };
    if (quantity <= minimum) return { color: "#92400e", fontWeight: 800 };
    return { color: COLORS.successText, fontWeight: 800 };
  }

  function sectionHeader(title, isOpen, setOpen, extra = null) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: isOpen ? 16 : 0, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "inline-block", background: COLORS.yellowSoft, color: COLORS.navy, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>WILMS</div>
          <h2 style={{ margin: 0, color: COLORS.navy }}>{title}</h2>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {extra}
          <button style={secondaryButtonStyle()} onClick={() => setOpen(!isOpen)}>{isOpen ? "Dichtvouwen" : "Openvouwen"}</button>
        </div>
      </div>
    );
  }

  function statCard(label, value) {
    return (
      <div style={blockStyle()}>
        <div style={{ fontSize: 13, color: COLORS.muted }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.navy, marginTop: 6 }}>{value}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif", maxWidth: 1200, margin: "0 auto", color: COLORS.text, background: COLORS.bg }}>
      <div style={{ background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.navy2} 100%)`, color: "#fff", borderRadius: 18, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "inline-block", background: COLORS.yellow, color: COLORS.navy, fontWeight: 800, padding: "6px 12px", borderRadius: 999, marginBottom: 10 }}>Nieuwe versie met voorraadbeheer</div>
        <h1 style={{ margin: 0, fontSize: 30 }}>Werkkledij Wilms</h1>
        <div style={{ marginTop: 6, opacity: 0.9 }}>Werknemers, punten, bestellingen, maten en voorraad in een dashboard</div>
      </div>

      {loading ? <div style={blockStyle()}>Data laden...</div> : null}
      {errorMessage ? <div style={{ background: COLORS.dangerBg, color: COLORS.dangerText, padding: 12, borderRadius: 12, marginBottom: 20, border: "1px solid #fecaca" }}>{errorMessage}</div> : null}
      {successMessage ? <div style={{ background: COLORS.successBg, color: COLORS.successText, padding: 12, borderRadius: 12, marginBottom: 20, border: "1px solid #bbf7d0" }}>{successMessage}</div> : null}
      {lowStockItems.length > 0 ? <div style={{ background: "#fef3c7", color: "#92400e", padding: 12, borderRadius: 12, marginBottom: 20, border: "1px solid #fde68a" }}><strong>Voorraadmelding:</strong> {lowStockItems.length} artikel/maat-combinatie(s) zitten op of onder de minimumvoorraad.</div> : null}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 20 }}>
        {statCard("Actieve werknemers", stats.activeEmployees)}
        {statCard("Totaal budget", stats.totalBudget)}
        {statCard("Verbruikt", stats.totalSpent)}
        {statCard("Resterend", stats.totalRemaining)}
        {statCard("Bestellingen", stats.totalOrders)}
        {statCard("Lage stock", stats.lowStock)}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Nieuwe bestelling", showNewOrder, setShowNewOrder)}
        {showNewOrder ? (
          <>
            <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
              <div><label>Werknemer</label><select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} style={inputStyle()}><option value="">Kies werknemer</option>{employeesWithStats.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.remaining} pt)</option>)}</select></div>
              <div><label>Artikel</label><select value={selectedCatalogId} onChange={(e) => { setSelectedCatalogId(e.target.value); setSelectedStockId(""); }} style={inputStyle()}><option value="">Kies artikel</option>{activeCatalogItems.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.points} pt)</option>)}</select></div>
              <div><label>Maat</label><select value={selectedStockId} onChange={(e) => setSelectedStockId(e.target.value)} style={inputStyle()} disabled={!selectedCatalogId}><option value="">Kies maat</option>{availableStockForSelectedArticle.map((stock) => <option key={stock.id} value={stock.id}>{stock.size}{stock.variant ? ` - ${stock.variant}` : ""} ({stock.quantity} op voorraad)</option>)}</select></div>
              <div><label>Aantal</label><input type="number" min="1" value={qty} onChange={(e) => setQty(Number(e.target.value))} style={inputStyle()} /></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button style={secondaryButtonStyle()} onClick={onAddLineToCart}>Artikel toevoegen</button><button style={primaryButtonStyle(!selectedEmployeeId || cart.length === 0)} onClick={onCreateOrder} disabled={!selectedEmployeeId || cart.length === 0}>Bestelling opslaan</button></div>
            </div>

            {selectedOrderEmployee ? <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: projectedRemaining !== null && projectedRemaining < 0 ? COLORS.dangerBg : COLORS.infoBg, color: projectedRemaining !== null && projectedRemaining < 0 ? COLORS.dangerText : COLORS.infoText }}><div><strong>Huidig saldo:</strong> {selectedOrderEmployee.remaining} pt</div><div><strong>Bestelling in mandje:</strong> {currentOrderTotal} pt</div><div><strong>Saldo na bestelling:</strong> {projectedRemaining !== null ? projectedRemaining : "-"} pt</div>{projectedRemaining !== null && projectedRemaining < 0 ? <div style={{ marginTop: 8, fontWeight: 700 }}>Waarschuwing: deze bestelling gaat boven het beschikbare saldo.</div> : null}</div> : null}

            <div style={{ marginTop: 20 }}><h3 style={{ color: COLORS.navy }}>Mandje</h3>{cart.length === 0 ? <div style={{ color: COLORS.muted }}>Nog geen artikels toegevoegd.</div> : <>{cart.map((line) => <div key={line.tempId} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}><div>{line.item_name} - maat {line.size}{line.variant ? ` (${line.variant})` : ""} - {line.qty} x {line.points_per_unit} pt = {line.qty * line.points_per_unit} pt</div><button style={secondaryButtonStyle()} onClick={() => onRemoveCartLine(line.tempId)}>Verwijderen</button></div>)}<div style={{ marginTop: 12, fontWeight: 800, color: COLORS.navy }}>Totaal: {currentOrderTotal} pt</div></>}</div>
          </>
        ) : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Nieuwe werknemer", showNewEmployee, setShowNewEmployee)}
        {showNewEmployee ? <div style={{ display: "grid", gap: 12, maxWidth: 420 }}><div><label>Voornaam</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle()} /></div><div><label>Achternaam</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle()} /></div><div><label>Statuut</label><select value={employeeStatus} onChange={(e) => setEmployeeStatus(e.target.value)} style={inputStyle()}><option value="Arbeider">Arbeider</option><option value="Bediende">Bediende</option></select></div><button style={primaryButtonStyle()} onClick={onAddEmployee}>Werknemer toevoegen</button></div> : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Werknemers", showEmployees, setShowEmployees, <span>{filteredEmployees.length} gevonden</span>)}
        {showEmployees ? <><div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 16 }}><div><label>Zoek op naam</label><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={inputStyle()} /></div><div><label>Statuut</label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle()}><option value="all">Alle statuten</option><option value="Arbeider">Arbeider</option><option value="Bediende">Bediende</option></select></div><div><label>Status</label><select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} style={inputStyle()}><option value="active">Alleen actief</option><option value="inactive">Alleen inactief</option><option value="all">Alles</option></select></div></div>{filteredEmployees.map((employee) => <div key={employee.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap" }}><div><strong>{employee.full_name}</strong> ({employee.status}) - budget {employee.budget} / verbruikt {employee.spent} / saldo <span style={{ fontWeight: 800, color: employee.remaining < 0 ? COLORS.dangerText : COLORS.text }}>{employee.remaining}</span>{!employee.active ? " - inactief" : ""}</div><div style={{ display: "flex", gap: 8 }}><button style={secondaryButtonStyle()} onClick={() => setDetailEmployeeId(employee.id)}>Detail</button><button style={secondaryButtonStyle()} onClick={() => onToggleEmployee(employee)}>{employee.active ? "Inactief zetten" : "Activeren"}</button></div></div>)}</> : null}
      </div>

      {detailEmployee ? <div style={blockStyle()}><h2 style={{ marginTop: 0, color: COLORS.navy }}>Werknemerdetail: {detailEmployee.full_name}</h2><div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 20 }}><div><strong>Statuut:</strong> {detailEmployee.status}</div><div><strong>Budget:</strong> {detailEmployee.budget}</div><div><strong>Verbruikt:</strong> {detailEmployee.spent}</div><div><strong>Saldo:</strong> {detailEmployee.remaining}</div></div><div style={{ maxWidth: 320, marginBottom: 20 }}><label>Extra punten toevoegen</label><input type="number" value={extraPointsInput} onChange={(e) => setExtraPointsInput(e.target.value)} style={inputStyle()} /><div style={{ marginTop: 8, display: "flex", gap: 8 }}><button style={primaryButtonStyle()} onClick={onAddExtraPoints}>Opslaan</button><button style={secondaryButtonStyle()} onClick={() => setDetailEmployeeId(null)}>Sluiten</button></div></div><h3 style={{ color: COLORS.navy }}>Bestellingen</h3>{(ordersByEmployee[detailEmployee.id] || []).length === 0 ? <div style={{ color: COLORS.muted }}>Geen bestellingen voor deze werknemer.</div> : (ordersByEmployee[detailEmployee.id] || []).map((order) => <OrderCard key={order.id} order={order} lineLabel={lineLabel} onDeleteOrder={onDeleteOrder} dangerButtonStyle={dangerButtonStyle} />)}</div> : null}

      <div style={blockStyle()}>
        {sectionHeader("Catalogus", showCatalog, setShowCatalog)}
        {showCatalog ? <><div style={{ display: "grid", gap: 12, maxWidth: 420, marginBottom: 16 }}><div><label>Nieuw artikel</label><input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} style={inputStyle()} /></div><div><label>Punten</label><input type="number" value={newItemPoints} onChange={(e) => setNewItemPoints(e.target.value)} style={inputStyle()} /></div><button style={primaryButtonStyle()} onClick={onAddCatalogItem}>Artikel toevoegen</button></div>{catalogItems.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}><div>{item.name} ({item.points} pt){!item.active ? " - inactief" : ""}</div><button style={secondaryButtonStyle()} onClick={() => onToggleCatalogItem(item)}>{item.active ? "Inactief zetten" : "Activeren"}</button></div>)}</> : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Voorraadbeheer", showStock, setShowStock, <span>{stockItems.length} regels</span>)}
        {showStock ? <><div style={{ marginBottom: 12 }}><button style={secondaryButtonStyle()} onClick={exportStockCsv}>Exporteer voorraad CSV</button></div>{stockItems.map((stock) => <div key={stock.id} style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr 1fr 1fr auto auto auto", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}><div><strong>{stock.item_name}</strong>{stock.variant ? ` - ${stock.variant}` : ""}{!stock.active ? " - inactief" : ""}</div><div>Maat: {stock.size}</div><div style={stockStyle(stock)}>Voorraad: {stock.quantity}{Number(stock.quantity || 0) <= Number(stock.minimum_quantity || 2) ? " ⚠" : ""}</div><div>Min: {stock.minimum_quantity}</div><button style={secondaryButtonStyle()} onClick={() => onChangeStockQuantity(stock, -1)}>-1</button><button style={secondaryButtonStyle()} onClick={() => onChangeStockQuantity(stock, 1)}>+1</button><button style={secondaryButtonStyle()} onClick={() => onToggleStockItem(stock)}>{stock.active ? "Deactiveren" : "Activeren"}</button></div>)}</> : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Bestellingen per werknemer", showOrders, setShowOrders)}
        {showOrders ? <>{employeesWithStats.map((employee) => { const orders = ordersByEmployee[employee.id] || []; if (orders.length === 0) return null; return <div key={employee.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12, marginBottom: 12, background: "#fff" }}><h3 style={{ marginTop: 0, color: COLORS.navy }}>{employee.full_name}</h3>{orders.map((order) => <OrderCard key={order.id} order={order} lineLabel={lineLabel} onDeleteOrder={onDeleteOrder} dangerButtonStyle={dangerButtonStyle} />)}</div>; })}</> : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Export", showExport, setShowExport)}
        {showExport ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button style={secondaryButtonStyle()} onClick={exportEmployeesCsv}>Exporteer werknemers CSV</button><button style={secondaryButtonStyle()} onClick={exportOrdersCsv}>Exporteer bestellingen CSV</button><button style={secondaryButtonStyle()} onClick={exportStockCsv}>Exporteer voorraad CSV</button></div> : null}
      </div>
    </div>
  );
}

function OrderCard({ order, lineLabel, onDeleteOrder, dangerButtonStyle }) {
  return (
    <div style={{ borderTop: "1px solid #d9dee8", paddingTop: 10, marginTop: 10 }}>
      <div style={{ marginBottom: 6 }}><strong>Datum:</strong> {order.order_date}</div>
      <div style={{ marginBottom: 6 }}><strong>Status:</strong> {order.status}</div>
      <ul>{(order.lines || []).map((line) => <li key={line.id}>{lineLabel(line)} - {line.qty} x {line.points_per_unit} pt</li>)}</ul>
      <button style={dangerButtonStyle()} onClick={() => onDeleteOrder(order)}>Bestelling verwijderen en voorraad terugzetten</button>
    </div>
  );
}
