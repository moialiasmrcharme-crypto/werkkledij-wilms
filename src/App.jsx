import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

export default function App() {
  const [employees, setEmployees] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [ordersByEmployee, setOrdersByEmployee] = useState({});

  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [status, setStatus] = useState("Arbeider");
  const [savingEmployee, setSavingEmployee] = useState(false);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [orderCart, setOrderCart] = useState([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const [newItemName, setNewItemName] = useState("");
  const [newItemPoints, setNewItemPoints] = useState("");
  const [savingItem, setSavingItem] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("active");

  const [detailEmployeeId, setDetailEmployeeId] = useState(null);
  const [extraPointsInput, setExtraPointsInput] = useState("");
  const [savingExtraPoints, setSavingExtraPoints] = useState(false);

  const [showNewEmployee, setShowNewEmployee] = useState(true);
  const [showNewOrder, setShowNewOrder] = useState(true);
  const [showNewItem, setShowNewItem] = useState(false);
  const [showSearchFilter, setShowSearchFilter] = useState(true);
  const [showEmployees, setShowEmployees] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showOrdersOverview, setShowOrdersOverview] = useState(false);
  const [showExports, setShowExports] = useState(false);

  const [editQtyByLineId, setEditQtyByLineId] = useState({});
  const [addItemByOrderId, setAddItemByOrderId] = useState({});
  const [addQtyByOrderId, setAddQtyByOrderId] = useState({});

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

  const activeCatalogItems = useMemo(
    () => catalogItems.filter((item) => item.active),
    [catalogItems]
  );

  const employeesWithStats = useMemo(() => {
    return employees.map((employee) => {
      const basePoints = employee.status === "Arbeider" ? 300 : 40;
      const extraPoints = Number(employee.extra_points || 0);
      const budget = Math.min(500, basePoints + extraPoints);

      const orders = ordersByEmployee[employee.id] || [];
      const newSpent = orders.reduce((sum, order) => {
        return (
          sum +
          (order.lines || []).reduce(
            (lineSum, line) =>
              lineSum +
              Number(line.qty || 0) * Number(line.points_per_unit || 0),
            0
          )
        );
      }, 0);

      const openingSpent = Number(employee.opening_spent || 0);
      const spent = openingSpent + newSpent;

      return {
        ...employee,
        budget,
        spent,
        remaining: budget - spent,
      };
    });
  }, [employees, ordersByEmployee]);

  const filteredEmployees = useMemo(() => {
    let result = [...employeesWithStats];

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      result = result.filter((employee) =>
        (employee.full_name || "").toLowerCase().includes(search)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((employee) => employee.status === statusFilter);
    }

    if (activeFilter === "active") {
      result = result.filter((employee) => employee.active);
    } else if (activeFilter === "inactive") {
      result = result.filter((employee) => !employee.active);
    }

    result.sort((a, b) =>
      (a.full_name || "").localeCompare(b.full_name || "", "nl-BE")
    );

    return result;
  }, [employeesWithStats, searchTerm, statusFilter, activeFilter]);

  const selectedEmployee = useMemo(() => {
    return (
      employeesWithStats.find(
        (employee) => employee.id === Number(detailEmployeeId)
      ) || null
    );
  }, [employeesWithStats, detailEmployeeId]);

  const selectedOrderEmployee = useMemo(() => {
    return (
      employeesWithStats.find(
        (employee) => employee.id === Number(selectedEmployeeId)
      ) || null
    );
  }, [employeesWithStats, selectedEmployeeId]);

  const dashboardStats = useMemo(() => {
    const activeEmployees = employeesWithStats.filter((employee) => employee.active);
    const totalBudget = activeEmployees.reduce(
      (sum, employee) => sum + employee.budget,
      0
    );
    const totalSpent = activeEmployees.reduce(
      (sum, employee) => sum + employee.spent,
      0
    );
    const totalRemaining = activeEmployees.reduce(
      (sum, employee) => sum + employee.remaining,
      0
    );
    const totalOrders = Object.values(ordersByEmployee).reduce(
      (sum, employeeOrders) => sum + employeeOrders.length,
      0
    );

    return {
      activeEmployees: activeEmployees.length,
      totalBudget,
      totalSpent,
      totalRemaining,
      totalOrders,
    };
  }, [employeesWithStats, ordersByEmployee]);

  const currentOrderTotal = useMemo(() => {
    return orderCart.reduce(
      (sum, line) =>
        sum + Number(line.qty || 0) * Number(line.points_per_unit || 0),
      0
    );
  }, [orderCart]);

  const projectedRemaining = useMemo(() => {
    if (!selectedOrderEmployee) return null;
    return selectedOrderEmployee.remaining - currentOrderTotal;
  }, [selectedOrderEmployee, currentOrderTotal]);

  async function loadEmployees() {
    setLoadingEmployees(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("full_name", { ascending: true });

    setLoadingEmployees(false);

    if (error) {
      console.log("LOAD EMPLOYEES ERROR:", error);
      setErrorMessage("Werknemers konden niet geladen worden.");
      return;
    }

    setEmployees(data || []);
  }

  async function loadCatalog() {
    setLoadingCatalog(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("catalog_items")
      .select("*")
      .order("id", { ascending: true });

    setLoadingCatalog(false);

    if (error) {
      console.log("LOAD CATALOG ERROR:", error);
      setErrorMessage("Catalogus kon niet geladen worden.");
      return;
    }

    setCatalogItems(data || []);
  }

  async function loadOrdersAndLines() {
    setLoadingOrders(true);

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .order("id", { ascending: false });

    if (ordersError) {
      console.log("LOAD ORDERS ERROR:", ordersError);
      setLoadingOrders(false);
      setErrorMessage("Bestellingen konden niet geladen worden.");
      return;
    }

    const { data: lines, error: linesError } = await supabase
      .from("order_lines")
      .select("*")
      .order("id", { ascending: true });

    setLoadingOrders(false);

    if (linesError) {
      console.log("LOAD ORDER LINES ERROR:", linesError);
      setErrorMessage("Bestellijnen konden niet geladen worden.");
      return;
    }

    const grouped = {};
    (orders || []).forEach((order) => {
      const employeeId = order.employee_id;
      if (!grouped[employeeId]) grouped[employeeId] = [];
      grouped[employeeId].push({
        ...order,
        lines: (lines || []).filter((line) => line.order_id === order.id),
      });
    });

    setOrdersByEmployee(grouped);
  }

  useEffect(() => {
    async function init() {
      await Promise.all([loadEmployees(), loadCatalog(), loadOrdersAndLines()]);
    }
    init();
  }, []);

  async function onAddEmployee() {
    if (!firstName.trim() || !lastName.trim()) return;

    setSavingEmployee(true);
    setErrorMessage("");

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: `${lastName.trim()} ${firstName.trim()}`,
      email: "",
      status,
      active: true,
      extra_points: 0,
      opening_spent: 0,
    };

    const { data, error } = await supabase
      .from("employees")
      .insert([payload])
      .select();

    setSavingEmployee(false);

    if (error) {
      console.log("ADD EMPLOYEE ERROR:", error);
      setErrorMessage("Werknemer kon niet toegevoegd worden.");
      return;
    }

    setEmployees((prev) =>
      [...prev, ...(data || [])].sort((a, b) =>
        (a.full_name || "").localeCompare(b.full_name || "", "nl-BE")
      )
    );

    setFirstName("");
    setLastName("");
    setStatus("Arbeider");
    setShowEmployees(true);
  }

  async function onDeactivateEmployee(id) {
    setErrorMessage("");

    const { error } = await supabase
      .from("employees")
      .update({ active: false })
      .eq("id", id);

    if (error) {
      console.log("DEACTIVATE EMPLOYEE ERROR:", error);
      setErrorMessage("Werknemer kon niet inactief gezet worden.");
      return;
    }

    setEmployees((prev) =>
      prev.map((employee) =>
        employee.id === id ? { ...employee, active: false } : employee
      )
    );
  }

  async function onAddExtraPoints() {
    if (!selectedEmployee || !extraPointsInput) return;

    const pointsToAdd = Number(extraPointsInput);
    if (!Number.isFinite(pointsToAdd) || pointsToAdd === 0) return;

    setSavingExtraPoints(true);
    setErrorMessage("");

    const newExtraPoints = Number(selectedEmployee.extra_points || 0) + pointsToAdd;

    const { error } = await supabase
      .from("employees")
      .update({ extra_points: newExtraPoints })
      .eq("id", selectedEmployee.id);

    setSavingExtraPoints(false);

    if (error) {
      console.log("ADD EXTRA POINTS ERROR:", error);
      setErrorMessage("Extra punten konden niet opgeslagen worden.");
      return;
    }

    setEmployees((prev) =>
      prev.map((employee) =>
        employee.id === selectedEmployee.id
          ? { ...employee, extra_points: newExtraPoints }
          : employee
      )
    );

    setExtraPointsInput("");
  }

  async function onAddCatalogItem() {
    if (!newItemName.trim()) return;

    setSavingItem(true);
    setErrorMessage("");

    const payload = {
      name: newItemName.trim(),
      points: Number(newItemPoints) || 0,
      active: true,
    };

    const { data, error } = await supabase
      .from("catalog_items")
      .insert([payload])
      .select();

    setSavingItem(false);

    if (error) {
      console.log("ADD CATALOG ITEM ERROR:", error);
      setErrorMessage("Artikel kon niet toegevoegd worden.");
      return;
    }

    setCatalogItems((prev) => [...prev, ...(data || [])]);
    setNewItemName("");
    setNewItemPoints("");
    setShowCatalog(true);
  }

  async function onToggleCatalogItem(item) {
    setErrorMessage("");

    const nextActive = !item.active;

    const { error } = await supabase
      .from("catalog_items")
      .update({ active: nextActive })
      .eq("id", item.id);

    if (error) {
      console.log("TOGGLE CATALOG ITEM ERROR:", error);
      setErrorMessage("Artikelstatus kon niet aangepast worden.");
      return;
    }

    setCatalogItems((prev) =>
      prev.map((catalogItem) =>
        catalogItem.id === item.id
          ? { ...catalogItem, active: nextActive }
          : catalogItem
      )
    );
  }

  function onAddLineToCart() {
    if (!selectedItemId || qty <= 0) return;

    const item = catalogItems.find(
      (catalogItem) => String(catalogItem.id) === String(selectedItemId)
    );
    if (!item) return;

    setOrderCart((prev) => [
      ...prev,
      {
        tempId: Date.now() + Math.random(),
        item_id: item.id,
        item_name: item.name,
        qty: Number(qty),
        points_per_unit: item.points,
      },
    ]);

    setSelectedItemId("");
    setQty(1);
  }

  function onRemoveLineFromCart(tempId) {
    setOrderCart((prev) => prev.filter((line) => line.tempId !== tempId));
  }

  async function onCreateOrder() {
    if (!selectedEmployeeId) {
      setErrorMessage("Kies eerst een werknemer.");
      return;
    }

    if (!orderCart || orderCart.length === 0) {
      setErrorMessage("Voeg eerst minstens 1 artikel toe aan de bestelling.");
      return;
    }

    setSavingOrder(true);
    setErrorMessage("");

    try {
      const employeeId = Number(selectedEmployeeId);

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([
          {
            employee_id: employeeId,
            order_date: new Date().toISOString().slice(0, 10),
            status: "Besteld",
            note: "",
          },
        ])
        .select();

      if (orderError) {
        console.log("CREATE ORDER ERROR:", orderError);
        setErrorMessage("Bestelling kon niet opgeslagen worden.");
        return;
      }

      const order = orderData?.[0];
      if (!order) {
        setErrorMessage("Bestelling werd niet correct aangemaakt.");
        return;
      }

      const insertLines = orderCart.map((line) => ({
        order_id: order.id,
        item_id: Number(line.item_id),
        qty: Number(line.qty),
        points_per_unit: Number(line.points_per_unit),
      }));

      const { data: lineData, error: lineError } = await supabase
        .from("order_lines")
        .insert(insertLines)
        .select();

      if (lineError) {
        console.log("CREATE ORDER LINES ERROR:", lineError);
        await supabase.from("orders").delete().eq("id", order.id);
        setErrorMessage("Bestellijnen konden niet opgeslagen worden.");
        return;
      }

      setOrdersByEmployee((prev) => {
        const currentOrders = prev[employeeId] || [];
        return {
          ...prev,
          [employeeId]: [
            {
              ...order,
              lines: lineData || [],
            },
            ...currentOrders,
          ],
        };
      });

      setSelectedEmployeeId("");
      setSelectedItemId("");
      setQty(1);
      setOrderCart([]);
      setShowOrdersOverview(true);

      await loadOrdersAndLines();
    } catch (error) {
      console.log("ON CREATE ORDER UNEXPECTED ERROR:", error);
      setErrorMessage("Er liep iets mis bij het opslaan van de bestelling.");
    } finally {
      setSavingOrder(false);
    }
  }

  async function onDeleteOrder(orderId) {
    setErrorMessage("");

    const { error: linesError } = await supabase
      .from("order_lines")
      .delete()
      .eq("order_id", orderId);

    if (linesError) {
      console.log("DELETE ORDER LINES ERROR:", linesError);
      setErrorMessage("Bestellijnen konden niet verwijderd worden.");
      return;
    }

    const { error: orderError } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId);

    if (orderError) {
      console.log("DELETE ORDER ERROR:", orderError);
      setErrorMessage("Bestelling kon niet verwijderd worden.");
      return;
    }

    await loadOrdersAndLines();
  }

  async function onDeleteOrderLine(lineId) {
    setErrorMessage("");

    const { error } = await supabase
      .from("order_lines")
      .delete()
      .eq("id", lineId);

    if (error) {
      console.log("DELETE ORDER LINE ERROR:", error);
      setErrorMessage("Bestellijn kon niet verwijderd worden.");
      return;
    }

    await loadOrdersAndLines();
  }

  async function onUpdateOrderLineQty(lineId) {
    const nextQty = Number(editQtyByLineId[lineId]);

    if (!Number.isFinite(nextQty) || nextQty <= 0) {
      setErrorMessage("Aantal moet groter zijn dan 0.");
      return;
    }

    setErrorMessage("");

    const { error } = await supabase
      .from("order_lines")
      .update({ qty: nextQty })
      .eq("id", lineId);

    if (error) {
      console.log("UPDATE ORDER LINE QTY ERROR:", error);
      setErrorMessage("Aantal kon niet aangepast worden.");
      return;
    }

    await loadOrdersAndLines();
  }

  async function onAddLineToExistingOrder(orderId) {
    const itemId = Number(addItemByOrderId[orderId]);
    const addQty = Number(addQtyByOrderId[orderId] || 1);

    if (!itemId || !Number.isFinite(addQty) || addQty <= 0) {
      setErrorMessage("Kies een artikel en geldig aantal.");
      return;
    }

    const item = catalogItems.find((catalogItem) => catalogItem.id === itemId);
    if (!item) {
      setErrorMessage("Artikel niet gevonden.");
      return;
    }

    setErrorMessage("");

    const { error } = await supabase
      .from("order_lines")
      .insert([
        {
          order_id: orderId,
          item_id: item.id,
          qty: addQty,
          points_per_unit: item.points,
        },
      ]);

    if (error) {
      console.log("ADD LINE TO EXISTING ORDER ERROR:", error);
      setErrorMessage("Artikel kon niet toegevoegd worden aan bestelling.");
      return;
    }

    setAddItemByOrderId((prev) => ({ ...prev, [orderId]: "" }));
    setAddQtyByOrderId((prev) => ({ ...prev, [orderId]: 1 }));

    await loadOrdersAndLines();
  }

  function getItemName(itemId) {
    const item = catalogItems.find((catalogItem) => catalogItem.id === itemId);
    return item ? item.name : `Artikel ${itemId}`;
  }

  function exportEmployeesCsv() {
    const rows = employeesWithStats.map((employee) => ({
      full_name: employee.full_name || "",
      first_name: employee.first_name || "",
      last_name: employee.last_name || "",
      status: employee.status || "",
      active: employee.active ? "true" : "false",
      extra_points: employee.extra_points || 0,
      opening_spent: employee.opening_spent || 0,
      budget: employee.budget || 0,
      spent: employee.spent || 0,
      remaining: employee.remaining || 0,
    }));

    downloadCsv("werknemers_export.csv", rows);
  }

  function exportOrdersCsv() {
    const rows = [];

    employeesWithStats.forEach((employee) => {
      const employeeOrders = ordersByEmployee[employee.id] || [];

      employeeOrders.forEach((order) => {
        (order.lines || []).forEach((line) => {
          rows.push({
            employee_name: employee.full_name || "",
            order_id: order.id,
            order_date: order.order_date || "",
            status: order.status || "",
            item_name: getItemName(line.item_id),
            qty: line.qty || 0,
            points_per_unit: line.points_per_unit || 0,
            line_total:
              Number(line.qty || 0) * Number(line.points_per_unit || 0),
          });
        });
      });
    });

    downloadCsv("bestellingen_export.csv", rows);
  }

  function downloadCsv(filename, rows) {
    if (!rows || rows.length === 0) {
      setErrorMessage("Er is geen data om te exporteren.");
      return;
    }

    const headers = Object.keys(rows[0]);
    const escapeCell = (value) => {
      const stringValue = String(value ?? "");
      return `"${stringValue.replace(/"/g, '""')}"`;
    };

    const csvContent = [
      headers.map(escapeCell).join(";"),
      ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(";")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function blockStyle() {
    return {
      border: `1px solid ${COLORS.border}`,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      background: COLORS.card,
      boxShadow: "0 2px 10px rgba(16,24,40,0.05)",
    };
  }

  function inputStyle() {
    return {
      display: "block",
      width: "100%",
      padding: 11,
      marginTop: 4,
      borderRadius: 10,
      border: `1px solid ${COLORS.border}`,
      background: "#fff",
      color: COLORS.text,
      fontSize: 14,
    };
  }

  function primaryButtonStyle(disabled = false) {
    return {
      background: disabled ? "#c9ced8" : COLORS.navy,
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "10px 14px",
      fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
    };
  }

  function secondaryButtonStyle() {
    return {
      background: "#fff",
      color: COLORS.navy,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 10,
      padding: "10px 14px",
      fontWeight: 600,
      cursor: "pointer",
    };
  }

  function dangerButtonStyle() {
    return {
      background: "#fff",
      color: COLORS.dangerText,
      border: "1px solid #fecaca",
      borderRadius: 10,
      padding: "10px 14px",
      fontWeight: 600,
      cursor: "pointer",
    };
  }

  function warningCardStyle(isWarning) {
    return {
      marginTop: 16,
      padding: 12,
      borderRadius: 12,
      background: isWarning ? COLORS.dangerBg : COLORS.infoBg,
      color: isWarning ? COLORS.dangerText : COLORS.infoText,
      border: `1px solid ${isWarning ? "#fecaca" : "#bfdbfe"}`,
    };
  }

  function sectionHeader(title, isOpen, setOpen, extra = null) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: isOpen ? 16 : 0,
        }}
      >
        <div>
          <div
            style={{
              display: "inline-block",
              background: COLORS.yellowSoft,
              color: COLORS.navy,
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            WILMS
          </div>
          <h2 style={{ margin: 0, color: COLORS.navy }}>{title}</h2>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {extra}
          <button style={secondaryButtonStyle()} onClick={() => setOpen(!isOpen)}>
            {isOpen ? "Dichtvouwen" : "Openvouwen"}
          </button>
        </div>
      </div>
    );
  }

  function statCard(label, value) {
    return (
      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 2px 10px rgba(16,24,40,0.05)",
        }}
      >
        <div style={{ fontSize: 13, color: COLORS.muted }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.navy, marginTop: 6 }}>
          {value}
        </div>
      </div>
    );
  }

  function renderOrder(order, employeeName = "") {
    return (
      <div
        key={order.id}
        style={{
          borderTop: `1px solid ${COLORS.border}`,
          paddingTop: 10,
          marginTop: 10,
        }}
      >
        <div style={{ marginBottom: 6 }}>
          <strong>Datum:</strong> {order.order_date}
        </div>
        <div style={{ marginBottom: 6 }}>
          <strong>Status:</strong> {order.status}
        </div>
        {employeeName ? (
          <div style={{ marginBottom: 6 }}>
            <strong>Werknemer:</strong> {employeeName}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button style={dangerButtonStyle()} onClick={() => onDeleteOrder(order.id)}>
            Volledige bestelling verwijderen
          </button>
        </div>

        <div>
          {(order.lines || []).map((line) => (
            <div
              key={line.id}
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "2fr 1fr 1fr auto auto",
                alignItems: "center",
                borderBottom: `1px solid ${COLORS.border}`,
                padding: "8px 0",
              }}
            >
              <div>{getItemName(line.item_id)}</div>
              <div>{line.points_per_unit} pt/stuk</div>
              <div>
                <input
                  type="number"
                  min="1"
                  value={editQtyByLineId[line.id] ?? line.qty}
                  onChange={(e) =>
                    setEditQtyByLineId((prev) => ({
                      ...prev,
                      [line.id]: e.target.value,
                    }))
                  }
                  style={{ ...inputStyle(), marginTop: 0, padding: 8 }}
                />
              </div>
              <button
                style={secondaryButtonStyle()}
                onClick={() => onUpdateOrderLineQty(line.id)}
              >
                Aantal opslaan
              </button>
              <button
                style={dangerButtonStyle()}
                onClick={() => onDeleteOrderLine(line.id)}
              >
                Lijn verwijderen
              </button>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: COLORS.infoBg,
            border: "1px solid #bfdbfe",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8, color: COLORS.navy }}>
            Artikel toevoegen aan bestaande bestelling
          </div>
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "2fr 1fr auto",
              alignItems: "end",
            }}
          >
            <div>
              <label>Artikel</label>
              <select
                value={addItemByOrderId[order.id] || ""}
                onChange={(e) =>
                  setAddItemByOrderId((prev) => ({
                    ...prev,
                    [order.id]: e.target.value,
                  }))
                }
                style={inputStyle()}
              >
                <option value="">Kies artikel</option>
                {activeCatalogItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.points} pt)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Aantal</label>
              <input
                type="number"
                min="1"
                value={addQtyByOrderId[order.id] || 1}
                onChange={(e) =>
                  setAddQtyByOrderId((prev) => ({
                    ...prev,
                    [order.id]: e.target.value,
                  }))
                }
                style={inputStyle()}
              />
            </div>

            <button
              style={secondaryButtonStyle()}
              onClick={() => onAddLineToExistingOrder(order.id)}
            >
              Toevoegen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "Arial, sans-serif",
        maxWidth: 1200,
        margin: "0 auto",
        color: COLORS.text,
        background: COLORS.bg,
      }}
    >
      <div
        style={{
          background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.navy2} 100%)`,
          color: "#fff",
          borderRadius: 18,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: COLORS.yellow,
            color: COLORS.navy,
            fontWeight: 800,
            padding: "6px 12px",
            borderRadius: 999,
            marginBottom: 10,
          }}
        >
          Werkkledijbeheer
        </div>
        <h1 style={{ margin: 0, fontSize: 30 }}>Werkkledij Wilms</h1>
        <div style={{ marginTop: 6, opacity: 0.9 }}>
          Beheer werknemers, punten, artikels en bestellingen op één plek
        </div>
      </div>

      {errorMessage ? (
        <div
          style={{
            background: COLORS.dangerBg,
            color: COLORS.dangerText,
            padding: 12,
            borderRadius: 12,
            marginBottom: 20,
            border: "1px solid #fecaca",
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: 20,
        }}
      >
        {statCard("Actieve werknemers", dashboardStats.activeEmployees)}
        {statCard("Totaal budget", dashboardStats.totalBudget)}
        {statCard("Verbruikt", dashboardStats.totalSpent)}
        {statCard("Resterend", dashboardStats.totalRemaining)}
        {statCard("Bestellingen", dashboardStats.totalOrders)}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Nieuwe werknemer", showNewEmployee, setShowNewEmployee)}
        {showNewEmployee ? (
          <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
            <div>
              <label>Voornaam</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle()} />
            </div>
            <div>
              <label>Achternaam</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle()} />
            </div>
            <div>
              <label>Statuut</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle()}>
                <option value="Arbeider">Arbeider</option>
                <option value="Bediende">Bediende</option>
              </select>
            </div>
            <div>
              <button style={primaryButtonStyle(savingEmployee)} onClick={onAddEmployee} disabled={savingEmployee}>
                {savingEmployee ? "Opslaan..." : "Werknemer toevoegen"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Nieuwe bestelling", showNewOrder, setShowNewOrder)}
        {showNewOrder ? (
          <>
            <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
              <div>
                <label>Werknemer</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  style={inputStyle()}
                >
                  <option value="">Kies werknemer</option>
                  {employeesWithStats
                    .filter((employee) => employee.active)
                    .map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name} ({employee.remaining} pt)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label>Artikel</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  style={inputStyle()}
                >
                  <option value="">Kies artikel</option>
                  {activeCatalogItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.points} pt)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Aantal</label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  style={inputStyle()}
                />
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={secondaryButtonStyle()} onClick={onAddLineToCart}>
                  Artikel toevoegen
                </button>
                <button
                  style={primaryButtonStyle(savingOrder || !selectedEmployeeId || orderCart.length === 0)}
                  onClick={onCreateOrder}
                  disabled={savingOrder || !selectedEmployeeId || orderCart.length === 0}
                >
                  {savingOrder ? "Opslaan..." : "Bestelling opslaan"}
                </button>
              </div>
            </div>

            {selectedOrderEmployee ? (
              <div style={warningCardStyle(projectedRemaining !== null && projectedRemaining < 0)}>
                <div><strong>Huidig saldo:</strong> {selectedOrderEmployee.remaining} pt</div>
                <div><strong>Bestelling in mandje:</strong> {currentOrderTotal} pt</div>
                <div><strong>Saldo na bestelling:</strong> {projectedRemaining !== null ? projectedRemaining : "-"} pt</div>
                {projectedRemaining !== null && projectedRemaining < 0 ? (
                  <div style={{ marginTop: 8, fontWeight: 700 }}>
                    Waarschuwing: deze bestelling gaat boven het beschikbare saldo.
                  </div>
                ) : null}
              </div>
            ) : null}

            <div style={{ marginTop: 20 }}>
              <h3 style={{ color: COLORS.navy }}>Bestellijnen</h3>
              {orderCart.length === 0 ? (
                <div style={{ color: COLORS.muted }}>Nog geen artikels toegevoegd.</div>
              ) : (
                <div>
                  {orderCart.map((line) => (
                    <div
                      key={line.tempId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: `1px solid ${COLORS.border}`,
                        padding: "8px 0",
                        gap: 12,
                      }}
                    >
                      <div>
                        {line.item_name} - {line.qty} x {line.points_per_unit} pt ={" "}
                        {line.qty * line.points_per_unit} pt
                      </div>
                      <button style={secondaryButtonStyle()} onClick={() => onRemoveLineFromCart(line.tempId)}>
                        Verwijderen
                      </button>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, fontWeight: 800, color: COLORS.navy }}>
                    Totaal: {currentOrderTotal} pt
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Nieuw artikel", showNewItem, setShowNewItem)}
        {showNewItem ? (
          <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
            <div>
              <label>Artikelnaam</label>
              <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} style={inputStyle()} />
            </div>
            <div>
              <label>Punten</label>
              <input type="number" value={newItemPoints} onChange={(e) => setNewItemPoints(e.target.value)} style={inputStyle()} />
            </div>
            <div>
              <button style={primaryButtonStyle(savingItem)} onClick={onAddCatalogItem} disabled={savingItem}>
                {savingItem ? "Opslaan..." : "Artikel toevoegen"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Zoek en filter werknemers", showSearchFilter, setShowSearchFilter)}
        {showSearchFilter ? (
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div>
              <label>Zoek op naam</label>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="bv. Meeus of Janssens"
                style={inputStyle()}
              />
            </div>

            <div>
              <label>Filter op statuut</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle()}>
                <option value="all">Alle statuten</option>
                <option value="Arbeider">Arbeider</option>
                <option value="Bediende">Bediende</option>
              </select>
            </div>

            <div>
              <label>Filter op status</label>
              <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} style={inputStyle()}>
                <option value="active">Alleen actief</option>
                <option value="inactive">Alleen inactief</option>
                <option value="all">Alles</option>
              </select>
            </div>
          </div>
        ) : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader(
          "Werknemers",
          showEmployees,
          setShowEmployees,
          <span style={{ color: COLORS.muted }}>{filteredEmployees.length} gevonden</span>
        )}
        {showEmployees ? (
          <>
            {loadingEmployees ? <div>Werknemers laden...</div> : null}
            {filteredEmployees.map((employee) => (
              <div
                key={employee.id}
                style={{
                  padding: 12,
                  borderBottom: `1px solid ${COLORS.border}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <strong>{employee.full_name}</strong> ({employee.status}) - budget{" "}
                  {employee.budget} / verbruikt {employee.spent} / saldo{" "}
                  <span style={{ color: employee.remaining < 0 ? COLORS.dangerText : COLORS.text, fontWeight: 700 }}>
                    {employee.remaining}
                  </span>
                  {!employee.active && <span> - inactief</span>}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button style={secondaryButtonStyle()} onClick={() => setDetailEmployeeId(employee.id)}>
                    Detail
                  </button>
                  {employee.active ? (
                    <button style={secondaryButtonStyle()} onClick={() => onDeactivateEmployee(employee.id)}>
                      Inactief zetten
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </>
        ) : null}
      </div>

      {selectedEmployee ? (
        <div style={blockStyle()}>
          <h2 style={{ marginTop: 0, color: COLORS.navy }}>
            Werknemerdetail: {selectedEmployee.full_name}
          </h2>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              marginBottom: 20,
            }}
          >
            <div><strong>Statuut:</strong> {selectedEmployee.status}</div>
            <div><strong>Budget:</strong> {selectedEmployee.budget}</div>
            <div><strong>Historisch verbruikt:</strong> {selectedEmployee.opening_spent || 0}</div>
            <div><strong>Totaal verbruikt:</strong> {selectedEmployee.spent}</div>
            <div><strong>Saldo:</strong> {selectedEmployee.remaining}</div>
          </div>

          <div style={{ maxWidth: 320, marginBottom: 20 }}>
            <label>Extra punten toevoegen</label>
            <input
              type="number"
              value={extraPointsInput}
              onChange={(e) => setExtraPointsInput(e.target.value)}
              style={inputStyle()}
            />
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button style={primaryButtonStyle(savingExtraPoints)} onClick={onAddExtraPoints} disabled={savingExtraPoints}>
                {savingExtraPoints ? "Opslaan..." : "Extra punten opslaan"}
              </button>
              <button style={secondaryButtonStyle()} onClick={() => setDetailEmployeeId(null)}>
                Sluiten
              </button>
            </div>
          </div>

          <h3 style={{ color: COLORS.navy }}>Bestellingen</h3>
          {(ordersByEmployee[selectedEmployee.id] || []).length === 0 ? (
            <div style={{ color: COLORS.muted }}>Geen bestellingen voor deze werknemer.</div>
          ) : (
            (ordersByEmployee[selectedEmployee.id] || []).map((order) =>
              renderOrder(order)
            )
          )}
        </div>
      ) : null}

      <div style={blockStyle()}>
        {sectionHeader("Catalogus", showCatalog, setShowCatalog)}
        {showCatalog ? (
          <>
            {loadingCatalog ? <div>Catalogus laden...</div> : null}
            {catalogItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "8px 0",
                  borderBottom: `1px solid ${COLORS.border}`,
                  alignItems: "center",
                }}
              >
                <div>
                  {item.name} ({item.points} pt){!item.active ? " - inactief" : ""}
                </div>
                <button style={secondaryButtonStyle()} onClick={() => onToggleCatalogItem(item)}>
                  {item.active ? "Inactief zetten" : "Activeren"}
                </button>
              </div>
            ))}
          </>
        ) : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Bestellingen per werknemer", showOrdersOverview, setShowOrdersOverview)}
        {showOrdersOverview ? (
          <>
            {loadingOrders ? <div>Bestellingen laden...</div> : null}
            {employeesWithStats.map((employee) => {
              const employeeOrders = ordersByEmployee[employee.id] || [];
              if (employeeOrders.length === 0) return null;

              return (
                <div
                  key={employee.id}
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 12,
                    background: "#fff",
                  }}
                >
                  <h3 style={{ marginTop: 0, color: COLORS.navy }}>{employee.full_name}</h3>
                  {employeeOrders.map((order) =>
                    renderOrder(order, employee.full_name)
                  )}
                </div>
              );
            })}
          </>
        ) : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Export", showExports, setShowExports)}
        {showExports ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={secondaryButtonStyle()} onClick={exportEmployeesCsv}>
              Exporteer werknemers CSV
            </button>
            <button style={secondaryButtonStyle()} onClick={exportOrdersCsv}>
              Exporteer bestellingen CSV
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
