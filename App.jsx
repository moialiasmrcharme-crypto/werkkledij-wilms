import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

export default function App() {
  const [employees, setEmployees] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [ordersByEmployee, setOrdersByEmployee] = useState({});

  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingStock, setLoadingStock] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [status, setStatus] = useState("Arbeider");
  const [savingEmployee, setSavingEmployee] = useState(false);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedStockId, setSelectedStockId] = useState("");
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
  const [showStock, setShowStock] = useState(false);
  const [showOrdersOverview, setShowOrdersOverview] = useState(false);
  const [showExports, setShowExports] = useState(false);

  const ORDER_STATUSES = [
    "In aanvraag",
    "Goedgekeurd",
    "Besteld",
    "Geleverd",
    "Geannuleerd",
  ];

  const activeCatalogItems = useMemo(
    () => catalogItems.filter((item) => item.active),
    [catalogItems]
  );

  const activeStockForSelectedArticle = useMemo(() => {
    if (!selectedItemId) return [];
    const item = catalogItems.find(
      (catalogItem) => String(catalogItem.id) === String(selectedItemId)
    );
    if (!item) return [];

    return stockItems
      .filter(
        (stock) =>
          stock.active &&
          stock.item_name === item.name &&
          Number(stock.quantity || 0) > 0
      )
      .sort((a, b) => {
        const variantCompare = (a.variant || "").localeCompare(b.variant || "", "nl-BE");
        if (variantCompare !== 0) return variantCompare;
        return (a.size || "").localeCompare(b.size || "", "nl-BE");
      });
  }, [selectedItemId, catalogItems, stockItems]);

  const lowStockItems = useMemo(() => {
    return stockItems
      .filter((stock) => stock.active && Number(stock.quantity || 0) <= Number(stock.minimum_quantity || 2))
      .sort((a, b) => (a.item_name || "").localeCompare(b.item_name || "", "nl-BE"));
  }, [stockItems]);

  const employeesWithStats = useMemo(() => {
    return employees.map((employee) => {
      const basePoints = employee.status === "Arbeider" ? 300 : 40;
      const extraPoints = employee.extra_points || 0;
      const budget = Math.min(500, basePoints + extraPoints);

      const orders = ordersByEmployee[employee.id] || [];
      const newSpent = orders.reduce((sum, order) => {
        if (order.status === "Geannuleerd") return sum;
        return (
          sum +
          (order.lines || []).reduce(
            (lineSum, line) => lineSum + Number(line.qty || 0) * Number(line.points_per_unit || 0),
            0
          )
        );
      }, 0);

      const openingSpent = employee.opening_spent || 0;
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
      employeesWithStats.find((employee) => employee.id === Number(detailEmployeeId)) ||
      null
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
    const totalBudget = activeEmployees.reduce((sum, employee) => sum + employee.budget, 0);
    const totalSpent = activeEmployees.reduce((sum, employee) => sum + employee.spent, 0);
    const totalRemaining = activeEmployees.reduce((sum, employee) => sum + employee.remaining, 0);
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
      lowStock: lowStockItems.length,
    };
  }, [employeesWithStats, ordersByEmployee, lowStockItems]);

  const currentOrderTotal = useMemo(() => {
    return orderCart.reduce(
      (sum, line) => sum + Number(line.qty || 0) * Number(line.points_per_unit || 0),
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

  async function loadStock() {
    setLoadingStock(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("stock_items")
      .select("*")
      .order("item_name", { ascending: true });

    setLoadingStock(false);

    if (error) {
      console.log("LOAD STOCK ERROR:", error);
      setErrorMessage("Voorraad kon niet geladen worden.");
      return;
    }

    setStockItems(data || []);
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
      await Promise.all([loadEmployees(), loadCatalog(), loadStock(), loadOrdersAndLines()]);
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

    const newExtraPoints = (selectedEmployee.extra_points || 0) + pointsToAdd;

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

  async function onToggleStockItem(stockItem) {
    setErrorMessage("");

    const nextActive = !stockItem.active;

    const { error } = await supabase
      .from("stock_items")
      .update({ active: nextActive })
      .eq("id", stockItem.id);

    if (error) {
      console.log("TOGGLE STOCK ITEM ERROR:", error);
      setErrorMessage("Voorraadregel kon niet aangepast worden.");
      return;
    }

    setStockItems((prev) =>
      prev.map((item) =>
        item.id === stockItem.id ? { ...item, active: nextActive } : item
      )
    );
  }

  async function onUpdateStockQuantity(stockItem, nextQuantity) {
    const quantity = Number(nextQuantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setErrorMessage("Voorraad moet 0 of hoger zijn.");
      return;
    }

    setErrorMessage("");

    const { error } = await supabase
      .from("stock_items")
      .update({ quantity })
      .eq("id", stockItem.id);

    if (error) {
      console.log("UPDATE STOCK QUANTITY ERROR:", error);
      setErrorMessage("Voorraad kon niet aangepast worden.");
      return;
    }

    setStockItems((prev) =>
      prev.map((item) =>
        item.id === stockItem.id ? { ...item, quantity } : item
      )
    );
  }

  function onAddLineToCart() {
    if (!selectedItemId || !selectedStockId || qty <= 0) return;

    const item = catalogItems.find(
      (catalogItem) => String(catalogItem.id) === String(selectedItemId)
    );
    const stock = stockItems.find(
      (stockItem) => String(stockItem.id) === String(selectedStockId)
    );

    if (!item || !stock) return;

    if (Number(stock.quantity || 0) < Number(qty)) {
      setErrorMessage("Onvoldoende voorraad voor deze maat.");
      return;
    }

    setErrorMessage("");

    setOrderCart((prev) => [
      ...prev,
      {
        tempId: Date.now() + Math.random(),
        item_id: item.id,
        item_name: item.name,
        stock_item_id: stock.id,
        size: stock.size,
        variant: stock.variant || "",
        qty: Number(qty),
        points_per_unit: item.points,
        available_quantity: Number(stock.quantity || 0),
      },
    ]);

    setSelectedItemId("");
    setSelectedStockId("");
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

    for (const line of orderCart) {
      const stock = stockItems.find((stockItem) => stockItem.id === line.stock_item_id);
      if (!stock || Number(stock.quantity || 0) < Number(line.qty || 0)) {
        setErrorMessage(`Onvoldoende voorraad voor ${line.item_name} - ${line.size}.`);
        return;
      }
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
            status: "In aanvraag",
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
        stock_item_id: Number(line.stock_item_id),
        size: line.size,
        variant: line.variant || "",
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

      for (const line of orderCart) {
        const stock = stockItems.find((stockItem) => stockItem.id === line.stock_item_id);
        const nextQuantity = Number(stock.quantity || 0) - Number(line.qty || 0);

        const { error: stockError } = await supabase
          .from("stock_items")
          .update({ quantity: nextQuantity })
          .eq("id", line.stock_item_id);

        if (stockError) {
          console.log("UPDATE STOCK AFTER ORDER ERROR:", stockError);
          setErrorMessage("Bestelling is opgeslagen, maar voorraad kon niet volledig aangepast worden.");
          await loadStock();
          await loadOrdersAndLines();
          return;
        }
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
      setSelectedStockId("");
      setQty(1);
      setOrderCart([]);
      setShowOrdersOverview(true);

      await loadStock();
      await loadOrdersAndLines();
    } catch (error) {
      console.log("ON CREATE ORDER UNEXPECTED ERROR:", error);
      setErrorMessage("Er liep iets mis bij het opslaan van de bestelling.");
    } finally {
      setSavingOrder(false);
    }
  }

  async function onUpdateOrderStatus(orderId, employeeId, nextStatus) {
    setErrorMessage("");

    const { error } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", orderId);

    if (error) {
      console.log("UPDATE ORDER STATUS ERROR:", error);
      setErrorMessage("Bestelstatus kon niet aangepast worden.");
      return;
    }

    setOrdersByEmployee((prev) => {
      const currentOrders = prev[employeeId] || [];
      return {
        ...prev,
        [employeeId]: currentOrders.map((order) =>
          order.id === orderId ? { ...order, status: nextStatus } : order
        ),
      };
    });
  }

  function getItemName(itemId) {
    const item = catalogItems.find((catalogItem) => catalogItem.id === itemId);
    return item ? item.name : `Artikel ${itemId}`;
  }

  function getLineDescription(line) {
    const itemName = getItemName(line.item_id);
    const sizeText = line.size ? ` - maat ${line.size}` : "";
    const variantText = line.variant ? ` (${line.variant})` : "";
    return `${itemName}${sizeText}${variantText}`;
  }

  function exportStockCsv() {
    const rows = stockItems.map((stock) => ({
      artikel: stock.item_name || "",
      variant: stock.variant || "",
      maat: stock.size || "",
      voorraad: stock.quantity || 0,
      minimum: stock.minimum_quantity || 0,
      actief: stock.active ? "ja" : "nee",
      lage_stock:
        Number(stock.quantity || 0) <= Number(stock.minimum_quantity || 2)
          ? "ja"
          : "nee",
    }));

    downloadCsv("voorraad_export.csv", rows);
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
      border: "1px solid #ddd",
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      background: "#f8fafc",
    };
  }

  function inputStyle() {
    return {
      display: "block",
      width: "100%",
      padding: 10,
      marginTop: 4,
    };
  }

  function statusStyle(orderStatus) {
    const map = {
      "In aanvraag": { background: "#dbeafe", color: "#1d4ed8" },
      Goedgekeurd: { background: "#dcfce7", color: "#166534" },
      Besteld: { background: "#fef3c7", color: "#92400e" },
      Geleverd: { background: "#e9d5ff", color: "#6b21a8" },
      Geannuleerd: { background: "#fee2e2", color: "#991b1b" },
    };
    return {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      ...(map[orderStatus] || { background: "#e5e7eb", color: "#111827" }),
    };
  }

  function stockBadgeStyle(stock) {
    const quantity = Number(stock.quantity || 0);
    const minimum = Number(stock.minimum_quantity || 2);

    if (quantity <= 0) {
      return { color: "#991b1b", fontWeight: 700 };
    }

    if (quantity <= minimum) {
      return { color: "#92400e", fontWeight: 700 };
    }

    return { color: "#166534", fontWeight: 700 };
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
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {extra}
          <button onClick={() => setOpen(!isOpen)}>
            {isOpen ? "Dichtvouwen" : "Openvouwen"}
          </button>
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
      }}
    >
      <h1>Werkkledij Wilms (Admin)</h1>

      {errorMessage ? (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      {lowStockItems.length > 0 ? (
        <div
          style={{
            background: "#fef3c7",
            color: "#92400e",
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <strong>Voorraadmelding:</strong> {lowStockItems.length} artikel/maat-combinatie(s)
          zitten op of onder de minimumvoorraad.
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginBottom: 24,
        }}
      >
        <div style={blockStyle()}>
          <div style={{ fontSize: 13, color: "#64748b" }}>Actieve werknemers</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{dashboardStats.activeEmployees}</div>
        </div>
        <div style={blockStyle()}>
          <div style={{ fontSize: 13, color: "#64748b" }}>Totaal budget</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{dashboardStats.totalBudget}</div>
        </div>
        <div style={blockStyle()}>
          <div style={{ fontSize: 13, color: "#64748b" }}>Verbruikt</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{dashboardStats.totalSpent}</div>
        </div>
        <div style={blockStyle()}>
          <div style={{ fontSize: 13, color: "#64748b" }}>Resterend</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{dashboardStats.totalRemaining}</div>
        </div>
        <div style={blockStyle()}>
          <div style={{ fontSize: 13, color: "#64748b" }}>Bestellingen</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{dashboardStats.totalOrders}</div>
        </div>
        <div style={blockStyle()}>
          <div style={{ fontSize: 13, color: "#64748b" }}>Lage voorraad</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{dashboardStats.lowStock}</div>
        </div>
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Nieuwe werknemer", showNewEmployee, setShowNewEmployee)}
        {showNewEmployee ? (
          <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
            <div>
              <label>Voornaam</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={inputStyle()}
              />
            </div>

            <div>
              <label>Achternaam</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={inputStyle()}
              />
            </div>

            <div>
              <label>Statuut</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={inputStyle()}
              >
                <option value="Arbeider">Arbeider</option>
                <option value="Bediende">Bediende</option>
              </select>
            </div>

            <div>
              <button onClick={onAddEmployee} disabled={savingEmployee}>
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
                  onChange={(e) => {
                    setSelectedItemId(e.target.value);
                    setSelectedStockId("");
                  }}
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
                <label>Maat / variant</label>
                <select
                  value={selectedStockId}
                  onChange={(e) => setSelectedStockId(e.target.value)}
                  style={inputStyle()}
                  disabled={!selectedItemId}
                >
                  <option value="">Kies maat</option>
                  {activeStockForSelectedArticle.map((stock) => (
                    <option key={stock.id} value={stock.id}>
                      {stock.size}
                      {stock.variant ? ` - ${stock.variant}` : ""} ({stock.quantity} op voorraad)
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
                <button onClick={onAddLineToCart}>
                  Artikel toevoegen aan bestelling
                </button>
                <button
                  onClick={onCreateOrder}
                  disabled={
                    savingOrder || !selectedEmployeeId || orderCart.length === 0
                  }
                >
                  {savingOrder ? "Opslaan..." : "Volledige bestelling opslaan"}
                </button>
              </div>
            </div>

            {selectedOrderEmployee ? (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 8,
                  background: projectedRemaining !== null && projectedRemaining < 0
                    ? "#fee2e2"
                    : "#eff6ff",
                  color:
                    projectedRemaining !== null && projectedRemaining < 0
                      ? "#991b1b"
                      : "#1d4ed8",
                }}
              >
                <div>
                  <strong>Huidig saldo:</strong> {selectedOrderEmployee.remaining} pt
                </div>
                <div>
                  <strong>Bestelling in mandje:</strong> {currentOrderTotal} pt
                </div>
                <div>
                  <strong>Saldo na bestelling:</strong>{" "}
                  {projectedRemaining !== null ? projectedRemaining : "-"} pt
                </div>
                {projectedRemaining !== null && projectedRemaining < 0 ? (
                  <div style={{ marginTop: 8, fontWeight: 700 }}>
                    Waarschuwing: deze bestelling gaat boven het beschikbare saldo.
                  </div>
                ) : null}
              </div>
            ) : null}

            <div style={{ marginTop: 20 }}>
              <h3>Bestellijnen</h3>
              {orderCart.length === 0 ? (
                <div>Nog geen artikels toegevoegd.</div>
              ) : (
                <div>
                  {orderCart.map((line) => (
                    <div
                      key={line.tempId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid #eee",
                        padding: "8px 0",
                        gap: 12,
                      }}
                    >
                      <div>
                        {line.item_name} - maat {line.size}
                        {line.variant ? ` (${line.variant})` : ""} - {line.qty} x{" "}
                        {line.points_per_unit} pt = {line.qty * line.points_per_unit} pt
                      </div>
                      <button onClick={() => onRemoveLineFromCart(line.tempId)}>
                        Verwijderen
                      </button>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, fontWeight: 700 }}>
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
              <input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                style={inputStyle()}
              />
            </div>

            <div>
              <label>Punten</label>
              <input
                type="number"
                value={newItemPoints}
                onChange={(e) => setNewItemPoints(e.target.value)}
                style={inputStyle()}
              />
            </div>

            <div>
              <button onClick={onAddCatalogItem} disabled={savingItem}>
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
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={inputStyle()}
              >
                <option value="all">Alle statuten</option>
                <option value="Arbeider">Arbeider</option>
                <option value="Bediende">Bediende</option>
              </select>
            </div>

            <div>
              <label>Filter op status</label>
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                style={inputStyle()}
              >
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
          <span>{filteredEmployees.length} gevonden</span>
        )}
        {showEmployees ? (
          <>
            {loadingEmployees ? <div>Werknemers laden...</div> : null}

            {filteredEmployees.map((employee) => (
              <div
                key={employee.id}
                style={{
                  padding: 12,
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <strong>{employee.full_name}</strong> ({employee.status}) - budget{" "}
                  {employee.budget} / verbruikt {employee.spent} / saldo{" "}
                  {employee.remaining}
                  {!employee.active && <span> - inactief</span>}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setDetailEmployeeId(employee.id)}>
                    Detail
                  </button>
                  {employee.active ? (
                    <button onClick={() => onDeactivateEmployee(employee.id)}>
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
          <h2 style={{ marginTop: 0 }}>
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
            <div>
              <strong>Statuut:</strong> {selectedEmployee.status}
            </div>
            <div>
              <strong>Budget:</strong> {selectedEmployee.budget}
            </div>
            <div>
              <strong>Historisch verbruikt:</strong>{" "}
              {selectedEmployee.opening_spent || 0}
            </div>
            <div>
              <strong>Totaal verbruikt:</strong> {selectedEmployee.spent}
            </div>
            <div>
              <strong>Saldo:</strong> {selectedEmployee.remaining}
            </div>
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
              <button onClick={onAddExtraPoints} disabled={savingExtraPoints}>
                {savingExtraPoints ? "Opslaan..." : "Extra punten opslaan"}
              </button>
              <button onClick={() => setDetailEmployeeId(null)}>Sluiten</button>
            </div>
          </div>

          <h3>Bestellingen</h3>
          {(ordersByEmployee[selectedEmployee.id] || []).length === 0 ? (
            <div>Geen nieuwe bestellingen voor deze werknemer.</div>
          ) : (
            (ordersByEmployee[selectedEmployee.id] || []).map((order) => (
              <div
                key={order.id}
                style={{
                  borderTop: "1px solid #eee",
                  paddingTop: 10,
                  marginTop: 10,
                  opacity: order.status === "Geannuleerd" ? 0.6 : 1,
                }}
              >
                <div style={{ marginBottom: 6 }}>
                  <strong>Datum:</strong> {order.order_date}
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong>Status:</strong>{" "}
                  <span style={statusStyle(order.status)}>{order.status}</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  {ORDER_STATUSES.map((nextStatus) => (
                    <button
                      key={nextStatus}
                      onClick={() =>
                        onUpdateOrderStatus(
                          order.id,
                          selectedEmployee.id,
                          nextStatus
                        )
                      }
                      disabled={order.status === nextStatus}
                    >
                      {nextStatus}
                    </button>
                  ))}
                </div>

                <ul>
                  {(order.lines || []).map((line) => (
                    <li key={line.id}>
                      {getLineDescription(line)} - {line.qty} x{" "}
                      {line.points_per_unit} pt
                    </li>
                  ))}
                </ul>
              </div>
            ))
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
                  borderBottom: "1px solid #eee",
                  alignItems: "center",
                }}
              >
                <div>
                  {item.name} ({item.points} pt){!item.active ? " - inactief" : ""}
                </div>
                <button onClick={() => onToggleCatalogItem(item)}>
                  {item.active ? "Inactief zetten" : "Activeren"}
                </button>
              </div>
            ))}
          </>
        ) : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader(
          "Voorraadbeheer",
          showStock,
          setShowStock,
          <span>{stockItems.length} regels</span>
        )}
        {showStock ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <button onClick={exportStockCsv}>Exporteer voorraad CSV</button>
            </div>

            {loadingStock ? <div>Voorraad laden...</div> : null}

            {stockItems.map((stock) => (
              <div
                key={stock.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr auto auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div>
                  <strong>{stock.item_name}</strong>
                  {stock.variant ? ` - ${stock.variant}` : ""}
                  {!stock.active ? " - inactief" : ""}
                </div>
                <div>Maat: {stock.size}</div>
                <div style={stockBadgeStyle(stock)}>
                  Voorraad: {stock.quantity}
                  {Number(stock.quantity || 0) <= Number(stock.minimum_quantity || 2)
                    ? " ⚠"
                    : ""}
                </div>
                <div>Min: {stock.minimum_quantity}</div>
                <button onClick={() => onUpdateStockQuantity(stock, Number(stock.quantity || 0) + 1)}>
                  +1
                </button>
                <button onClick={() => onToggleStockItem(stock)}>
                  {stock.active ? "Deactiveren" : "Activeren"}
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
                    border: "1px solid #eee",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 12,
                    background: "#fff",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>{employee.full_name}</h3>

                  {employeeOrders.map((order) => (
                    <div
                      key={order.id}
                      style={{
                        borderTop: "1px solid #eee",
                        paddingTop: 10,
                        marginTop: 10,
                        opacity: order.status === "Geannuleerd" ? 0.6 : 1,
                      }}
                    >
                      <div style={{ marginBottom: 6 }}>
                        <strong>Datum:</strong> {order.order_date}
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <strong>Status:</strong>{" "}
                        <span style={statusStyle(order.status)}>{order.status}</span>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          marginBottom: 10,
                        }}
                      >
                        {ORDER_STATUSES.map((nextStatus) => (
                          <button
                            key={nextStatus}
                            onClick={() =>
                              onUpdateOrderStatus(order.id, employee.id, nextStatus)
                            }
                            disabled={order.status === nextStatus}
                          >
                            {nextStatus}
                          </button>
                        ))}
                      </div>

                      <ul>
                        {(order.lines || []).map((line) => (
                          <li key={line.id}>
                            {getLineDescription(line)} - {line.qty} x{" "}
                            {line.points_per_unit} pt
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        ) : null}
      </div>
    </div>
  );
}
