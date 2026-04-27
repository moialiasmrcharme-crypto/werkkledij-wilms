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

function isSockItem(name) {
  return String(name || "").toLowerCase().includes("sok");
}

function isShoeItem(name) {
  const value = String(name || "").toLowerCase();
  return value.includes("schoen") || value.includes("veiligheidsschoen");
}

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

  const [newItemName, setNewItemName] = useState("");
  const [newItemPoints, setNewItemPoints] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("active");

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [selectedStockId, setSelectedStockId] = useState("");
  const [customShoeModel, setCustomShoeModel] = useState("");
  const [customShoeSize, setCustomShoeSize] = useState("");
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState([]);

  const [detailEmployeeId, setDetailEmployeeId] = useState(null);
  const [editEmployeeName, setEditEmployeeName] = useState("");
  const [editEmployeeStatus, setEditEmployeeStatus] = useState("Arbeider");
  const [extraPointsInput, setExtraPointsInput] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const employee = employees.find((item) => String(item.id) === String(detailEmployeeId));
    if (employee) {
      setEditEmployeeName(employee.full_name || "");
      setEditEmployeeStatus(employee.status || "Arbeider");
    }
  }, [detailEmployeeId, employees]);

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

    if (employeesResult.error) {
      console.log("LOAD EMPLOYEES ERROR:", employeesResult.error);
      setErrorMessage("Werknemers konden niet geladen worden.");
      return;
    }

    if (catalogResult.error) {
      console.log("LOAD CATALOG ERROR:", catalogResult.error);
      setErrorMessage("Catalogus kon niet geladen worden.");
      return;
    }

    if (stockResult.error) {
      console.log("LOAD STOCK ERROR:", stockResult.error);
      setErrorMessage("Voorraad kon niet geladen worden.");
      return;
    }

    if (ordersResult.error) {
      console.log("LOAD ORDERS ERROR:", ordersResult.error);
      setErrorMessage("Bestellingen konden niet geladen worden.");
      return;
    }

    if (linesResult.error) {
      console.log("LOAD ORDER LINES ERROR:", linesResult.error);
      setErrorMessage("Bestellijnen konden niet geladen worden.");
      return;
    }

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

  const activeCatalogItems = useMemo(() => {
    return catalogItems.filter((item) => item.active);
  }, [catalogItems]);

  const selectedCatalogItem = useMemo(() => {
    return catalogItems.find((item) => String(item.id) === String(selectedCatalogId)) || null;
  }, [catalogItems, selectedCatalogId]);

  const selectedIsSock = isSockItem(selectedCatalogItem?.name);
  const selectedIsShoe = isShoeItem(selectedCatalogItem?.name);

  const availableStockForSelectedArticle = useMemo(() => {
    if (!selectedCatalogItem || selectedIsSock || selectedIsShoe) return [];

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
  }, [selectedCatalogItem, selectedIsSock, selectedIsShoe, stockItems]);

  const sockStockForSelectedArticle = useMemo(() => {
    if (!selectedCatalogItem || !selectedIsSock) return null;
    return (
      stockItems.find(
        (stock) =>
          stock.active &&
          stock.item_name === selectedCatalogItem.name &&
          Number(stock.quantity || 0) > 0
      ) || null
    );
  }, [selectedCatalogItem, selectedIsSock, stockItems]);

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
      const term = searchTerm.toLowerCase().trim();
      result = result.filter((employee) =>
        String(employee.full_name || "").toLowerCase().includes(term)
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

  function clearMessages() {
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function onAddEmployee() {
    clearMessages();

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage("Voornaam en achternaam zijn verplicht.");
      return;
    }

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

    if (error) {
      console.log("ADD EMPLOYEE ERROR:", error);
      setErrorMessage("Werknemer kon niet toegevoegd worden.");
      return;
    }

    setEmployees((prev) =>
      [...prev, ...(data || [])].sort((a, b) =>
        String(a.full_name || "").localeCompare(String(b.full_name || ""), "nl-BE")
      )
    );

    setFirstName("");
    setLastName("");
    setEmployeeStatus("Arbeider");
    setShowEmployees(true);
    setSuccessMessage("Werknemer toegevoegd.");
  }

  async function onSaveEmployeeDetails() {
    clearMessages();

    if (!detailEmployee) return;

    const fullName = editEmployeeName.trim();
    if (!fullName) {
      setErrorMessage("Naam mag niet leeg zijn.");
      return;
    }

    const parts = fullName.split(" ").filter(Boolean);
    const firstNameValue = parts.length > 1 ? parts.slice(1).join(" ") : "";
    const lastNameValue = parts[0] || fullName;

    const payload = {
      full_name: fullName,
      first_name: firstNameValue,
      last_name: lastNameValue,
      status: editEmployeeStatus,
    };

    const { error } = await supabase
      .from("employees")
      .update(payload)
      .eq("id", detailEmployee.id);

    if (error) {
      console.log("UPDATE EMPLOYEE ERROR:", error);
      setErrorMessage("Naam/statuut kon niet opgeslagen worden.");
      return;
    }

    setEmployees((prev) =>
      prev
        .map((employee) =>
          employee.id === detailEmployee.id ? { ...employee, ...payload } : employee
        )
        .sort((a, b) =>
          String(a.full_name || "").localeCompare(String(b.full_name || ""), "nl-BE")
        )
    );

    setSuccessMessage("Naam en statuut aangepast.");
  }

  async function onToggleEmployee(employee) {
    clearMessages();

    const nextActive = !employee.active;

    const { error } = await supabase
      .from("employees")
      .update({ active: nextActive })
      .eq("id", employee.id);

    if (error) {
      console.log("TOGGLE EMPLOYEE ERROR:", error);
      setErrorMessage("Werknemerstatus kon niet aangepast worden.");
      return;
    }

    setEmployees((prev) =>
      prev.map((item) => (item.id === employee.id ? { ...item, active: nextActive } : item))
    );
  }

  async function onAddExtraPoints() {
    clearMessages();

    if (!detailEmployee) return;

    const points = Number(extraPointsInput);
    if (!Number.isFinite(points) || points === 0) {
      setErrorMessage("Vul een geldig aantal extra punten in.");
      return;
    }

    const newExtraPoints = Number(detailEmployee.extra_points || 0) + points;

    const { error } = await supabase
      .from("employees")
      .update({ extra_points: newExtraPoints })
      .eq("id", detailEmployee.id);

    if (error) {
      console.log("EXTRA POINTS ERROR:", error);
      setErrorMessage("Extra punten konden niet opgeslagen worden.");
      return;
    }

    setEmployees((prev) =>
      prev.map((employee) =>
        employee.id === detailEmployee.id
          ? { ...employee, extra_points: newExtraPoints }
          : employee
      )
    );

    setExtraPointsInput("");
    setSuccessMessage("Extra punten opgeslagen.");
  }

  async function onAddCatalogItem() {
    clearMessages();

    if (!newItemName.trim()) {
      setErrorMessage("Artikelnaam is verplicht.");
      return;
    }

    const payload = {
      name: newItemName.trim(),
      points: Number(newItemPoints || 0),
      active: true,
    };

    const { data, error } = await supabase.from("catalog_items").insert([payload]).select();

    if (error) {
      console.log("ADD CATALOG ERROR:", error);
      setErrorMessage("Artikel kon niet toegevoegd worden.");
      return;
    }

    setCatalogItems((prev) => [...prev, ...(data || [])]);
    setNewItemName("");
    setNewItemPoints("");
    setShowCatalog(true);
    setSuccessMessage("Artikel toegevoegd.");
  }

  async function onToggleCatalogItem(item) {
    clearMessages();

    const nextActive = !item.active;

    const { error } = await supabase
      .from("catalog_items")
      .update({ active: nextActive })
      .eq("id", item.id);

    if (error) {
      console.log("TOGGLE CATALOG ERROR:", error);
      setErrorMessage("Artikelstatus kon niet aangepast worden.");
      return;
    }

    setCatalogItems((prev) =>
      prev.map((catalogItem) =>
        catalogItem.id === item.id ? { ...catalogItem, active: nextActive } : catalogItem
      )
    );
  }

  async function onToggleStockItem(item) {
    clearMessages();

    const nextActive = !item.active;

    const { error } = await supabase
      .from("stock_items")
      .update({ active: nextActive })
      .eq("id", item.id);

    if (error) {
      console.log("TOGGLE STOCK ERROR:", error);
      setErrorMessage("Voorraadregel kon niet aangepast worden.");
      return;
    }

    setStockItems((prev) =>
      prev.map((stock) => (stock.id === item.id ? { ...stock, active: nextActive } : stock))
    );
  }

  async function onChangeStockQuantity(item, delta) {
    clearMessages();

    const nextQuantity = Math.max(0, Number(item.quantity || 0) + delta);

    const { error } = await supabase
      .from("stock_items")
      .update({ quantity: nextQuantity })
      .eq("id", item.id);

    if (error) {
      console.log("UPDATE STOCK ERROR:", error);
      setErrorMessage("Voorraad kon niet aangepast worden.");
      return;
    }

    setStockItems((prev) =>
      prev.map((stock) => (stock.id === item.id ? { ...stock, quantity: nextQuantity } : stock))
    );
  }

  function onAddLineToCart() {
    clearMessages();

    if (!selectedCatalogItem) {
      setErrorMessage("Kies eerst een artikel.");
      return;
    }

    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setErrorMessage("Aantal moet groter zijn dan 0.");
      return;
    }

    if (selectedIsShoe) {
      if (!customShoeModel.trim() || !customShoeSize.trim()) {
        setErrorMessage("Voor schoenen moet je model en maat invullen.");
        return;
      }

      setCart((prev) => [
        ...prev,
        {
          tempId: Date.now() + Math.random(),
          item_id: selectedCatalogItem.id,
          item_name: selectedCatalogItem.name,
          stock_item_id: null,
          size: customShoeSize.trim(),
          variant: customShoeModel.trim(),
          qty: quantity,
          points_per_unit: Number(selectedCatalogItem.points || 0),
          no_stock: true,
        },
      ]);

      resetOrderLineInputs();
      return;
    }

    if (selectedIsSock) {
      if (sockStockForSelectedArticle) {
        const alreadyInCart = cart
          .filter((line) => line.stock_item_id === sockStockForSelectedArticle.id)
          .reduce((sum, line) => sum + Number(line.qty || 0), 0);

        if (Number(sockStockForSelectedArticle.quantity || 0) < alreadyInCart + quantity) {
          setErrorMessage("Onvoldoende voorraad voor sokken.");
          return;
        }
      }

      setCart((prev) => [
        ...prev,
        {
          tempId: Date.now() + Math.random(),
          item_id: selectedCatalogItem.id,
          item_name: selectedCatalogItem.name,
          stock_item_id: sockStockForSelectedArticle?.id || null,
          size: "",
          variant: "zonder maat",
          qty: quantity,
          points_per_unit: Number(selectedCatalogItem.points || 0),
          no_stock: !sockStockForSelectedArticle,
        },
      ]);

      resetOrderLineInputs();
      return;
    }

    const stock = stockItems.find((item) => String(item.id) === String(selectedStockId));
    if (!stock) {
      setErrorMessage("Kies eerst een maat.");
      return;
    }

    const alreadyInCart = cart
      .filter((line) => line.stock_item_id === stock.id)
      .reduce((sum, line) => sum + Number(line.qty || 0), 0);

    if (Number(stock.quantity || 0) < alreadyInCart + quantity) {
      setErrorMessage("Onvoldoende voorraad voor deze maat.");
      return;
    }

    setCart((prev) => [
      ...prev,
      {
        tempId: Date.now() + Math.random(),
        item_id: selectedCatalogItem.id,
        item_name: selectedCatalogItem.name,
        stock_item_id: stock.id,
        size: stock.size,
        variant: stock.variant || "",
        qty: quantity,
        points_per_unit: Number(selectedCatalogItem.points || 0),
        no_stock: false,
      },
    ]);

    resetOrderLineInputs();
  }

  function resetOrderLineInputs() {
    setSelectedCatalogId("");
    setSelectedStockId("");
    setCustomShoeModel("");
    setCustomShoeSize("");
    setQty(1);
  }

  function onRemoveCartLine(tempId) {
    setCart((prev) => prev.filter((line) => line.tempId !== tempId));
  }

  async function onCreateOrder() {
    clearMessages();

    if (!selectedEmployeeId) {
      setErrorMessage("Kies eerst een werknemer.");
      return;
    }

    if (cart.length === 0) {
      setErrorMessage("Voeg eerst minstens één artikel toe.");
      return;
    }

    for (const line of cart) {
      if (!line.stock_item_id) continue;

      const stock = stockItems.find((item) => item.id === line.stock_item_id);
      if (!stock || Number(stock.quantity || 0) < Number(line.qty || 0)) {
        setErrorMessage(`Onvoldoende voorraad voor ${line.item_name} ${line.size || ""}.`);
        return;
      }
    }

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

    const linePayload = cart.map((line) => ({
      order_id: order.id,
      item_id: Number(line.item_id),
      stock_item_id: line.stock_item_id ? Number(line.stock_item_id) : null,
      size: line.size || "",
      variant: line.variant || "",
      qty: Number(line.qty),
      points_per_unit: Number(line.points_per_unit),
    }));

    const { data: lineData, error: lineError } = await supabase
      .from("order_lines")
      .insert(linePayload)
      .select();

    if (lineError) {
      console.log("CREATE ORDER LINES ERROR:", lineError);
      await supabase.from("orders").delete().eq("id", order.id);
      setErrorMessage("Bestellijnen konden niet opgeslagen worden.");
      return;
    }

    for (const line of cart) {
      if (!line.stock_item_id) continue;

      const stock = stockItems.find((item) => item.id === line.stock_item_id);
      const nextQuantity = Number(stock.quantity || 0) - Number(line.qty || 0);

      const { error: stockError } = await supabase
        .from("stock_items")
        .update({ quantity: nextQuantity })
        .eq("id", line.stock_item_id);

      if (stockError) {
        console.log("UPDATE STOCK AFTER ORDER ERROR:", stockError);
        setErrorMessage("Bestelling is opgeslagen, maar voorraad kon niet volledig aangepast worden.");
        await loadAll();
        return;
      }
    }

    setOrdersByEmployee((prev) => ({
      ...prev,
      [employeeId]: [
        {
          ...order,
          lines: lineData || [],
        },
        ...(prev[employeeId] || []),
      ],
    }));

    setSelectedEmployeeId("");
    setCart([]);
    setShowOrders(true);
    setSuccessMessage("Bestelling opgeslagen en voorraad aangepast.");
    await loadAll();
  }

  async function onDeleteOrder(order) {
    clearMessages();

    const { error: lineError } = await supabase
      .from("order_lines")
      .delete()
      .eq("order_id", order.id);

    if (lineError) {
      console.log("DELETE ORDER LINES ERROR:", lineError);
      setErrorMessage("Bestellijnen konden niet verwijderd worden.");
      return;
    }

    const { error: orderError } = await supabase
      .from("orders")
      .delete()
      .eq("id", order.id);

    if (orderError) {
      console.log("DELETE ORDER ERROR:", orderError);
      setErrorMessage("Bestelling kon niet verwijderd worden.");
      return;
    }

    for (const line of order.lines || []) {
      if (!line.stock_item_id) continue;

      const stock = stockItems.find((item) => item.id === line.stock_item_id);
      if (!stock) continue;

      await supabase
        .from("stock_items")
        .update({ quantity: Number(stock.quantity || 0) + Number(line.qty || 0) })
        .eq("id", line.stock_item_id);
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
    const isShoeLine = isShoeItem(name);
    const isSockLine = isSockItem(name);

    if (isShoeLine) {
      return `${name} - model ${line.variant || "-"} - maat ${line.size || "-"}`;
    }

    if (isSockLine) {
      return `${name} - zonder maat`;
    }

    const size = line.size ? `maat ${line.size}` : "geen maat";
    const variant = line.variant ? ` - ${line.variant}` : "";
    return `${name} - ${size}${variant}`;
  }

  function exportEmployeesCsv() {
    const rows = employeesWithStats.map((employee) => ({
      naam: employee.full_name || "",
      statuut: employee.status || "",
      actief: employee.active ? "ja" : "nee",
      extra_punten: employee.extra_points || 0,
      historisch_verbruikt: employee.opening_spent || 0,
      budget: employee.budget || 0,
      verbruikt: employee.spent || 0,
      saldo: employee.remaining || 0,
    }));

    downloadCsv("werknemers_export.csv", rows);
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

  function exportOrdersCsv() {
    const rows = [];

    employeesWithStats.forEach((employee) => {
      const orders = ordersByEmployee[employee.id] || [];
      orders.forEach((order) => {
        (order.lines || []).forEach((line) => {
          rows.push({
            werknemer: employee.full_name || "",
            datum: order.order_date || "",
            status: order.status || "",
            artikel: getItemName(line.item_id),
            maat: line.size || "",
            variant: line.variant || "",
            aantal: line.qty || 0,
            punten_per_stuk: line.points_per_unit || 0,
            totaal: Number(line.qty || 0) * Number(line.points_per_unit || 0),
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
    const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [
      headers.map(escapeCell).join(";"),
      ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(";")),
    ].join("\n");

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

  function stockStyle(stock) {
    const quantity = Number(stock.quantity || 0);
    const minimum = Number(stock.minimum_quantity || 2);

    if (quantity <= 0) {
      return { color: COLORS.dangerText, fontWeight: 800 };
    }

    if (quantity <= minimum) {
      return { color: "#92400e", fontWeight: 800 };
    }

    return { color: COLORS.successText, fontWeight: 800 };
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
          flexWrap: "wrap",
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
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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
      <div style={blockStyle()}>
        <div style={{ fontSize: 13, color: COLORS.muted }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.navy, marginTop: 6 }}>
          {value}
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
          Nieuwe versie: sokken zonder maat, schoenen vrij invullen
        </div>
        <h1 style={{ margin: 0, fontSize: 30 }}>Werkkledij Wilms</h1>
        <div style={{ marginTop: 6, opacity: 0.9 }}>
          Werknemers, punten, bestellingen, maten en voorraad in één dashboard
        </div>
      </div>

      {loading ? <div style={blockStyle()}>Data laden...</div> : null}

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

      {successMessage ? (
        <div
          style={{
            background: COLORS.successBg,
            color: COLORS.successText,
            padding: 12,
            borderRadius: 12,
            marginBottom: 20,
            border: "1px solid #bbf7d0",
          }}
        >
          {successMessage}
        </div>
      ) : null}

      {lowStockItems.length > 0 ? (
        <div
          style={{
            background: "#fef3c7",
            color: "#92400e",
            padding: 12,
            borderRadius: 12,
            marginBottom: 20,
            border: "1px solid #fde68a",
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
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: 20,
        }}
      >
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
              <div>
                <label>Werknemer</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
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
                  value={selectedCatalogId}
                  onChange={(event) => {
                    setSelectedCatalogId(event.target.value);
                    setSelectedStockId("");
                    setCustomShoeModel("");
                    setCustomShoeSize("");
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

              {selectedCatalogItem && selectedIsSock ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: COLORS.infoBg,
                    color: COLORS.infoText,
                  }}
                >
                  Sokken worden zonder maat besteld.
                  {sockStockForSelectedArticle ? (
                    <div>Voorraad: {sockStockForSelectedArticle.quantity}</div>
                  ) : (
                    <div>Geen voorraadregel gekoppeld; bestelling kan wel worden geregistreerd.</div>
                  )}
                </div>
              ) : null}

              {selectedCatalogItem && selectedIsShoe ? (
                <>
                  <div>
                    <label>Model schoen</label>
                    <input
                      value={customShoeModel}
                      onChange={(event) => setCustomShoeModel(event.target.value)}
                      placeholder="bv. model/merk/type"
                      style={inputStyle()}
                    />
                  </div>
                  <div>
                    <label>Maat schoen</label>
                    <input
                      value={customShoeSize}
                      onChange={(event) => setCustomShoeSize(event.target.value)}
                      placeholder="bv. 42, 43, 44..."
                      style={inputStyle()}
                    />
                  </div>
                </>
              ) : null}

              {selectedCatalogItem && !selectedIsSock && !selectedIsShoe ? (
                <div>
                  <label>Maat</label>
                  <select
                    value={selectedStockId}
                    onChange={(event) => setSelectedStockId(event.target.value)}
                    style={inputStyle()}
                  >
                    <option value="">Kies maat</option>
                    {availableStockForSelectedArticle.map((stock) => (
                      <option key={stock.id} value={stock.id}>
                        {stock.size}
                        {stock.variant ? ` - ${stock.variant}` : ""} ({stock.quantity} op voorraad)
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label>Aantal</label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(event) => setQty(Number(event.target.value))}
                  style={inputStyle()}
                />
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={secondaryButtonStyle()} onClick={onAddLineToCart}>
                  Artikel toevoegen
                </button>
                <button
                  style={primaryButtonStyle(!selectedEmployeeId || cart.length === 0)}
                  onClick={onCreateOrder}
                  disabled={!selectedEmployeeId || cart.length === 0}
                >
                  Bestelling opslaan
                </button>
              </div>
            </div>

            {selectedOrderEmployee ? (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 12,
                  background:
                    projectedRemaining !== null && projectedRemaining < 0
                      ? COLORS.dangerBg
                      : COLORS.infoBg,
                  color:
                    projectedRemaining !== null && projectedRemaining < 0
                      ? COLORS.dangerText
                      : COLORS.infoText,
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
              <h3 style={{ color: COLORS.navy }}>Mandje</h3>
              {cart.length === 0 ? (
                <div style={{ color: COLORS.muted }}>Nog geen artikels toegevoegd.</div>
              ) : (
                <>
                  {cart.map((line) => (
                    <div
                      key={line.tempId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom: `1px solid ${COLORS.border}`,
                      }}
                    >
                      <div>
                        {line.item_name}
                        {isShoeItem(line.item_name)
                          ? ` - model ${line.variant} - maat ${line.size}`
                          : isSockItem(line.item_name)
                          ? " - zonder maat"
                          : ` - maat ${line.size}${line.variant ? ` (${line.variant})` : ""}`}{" "}
                        - {line.qty} x {line.points_per_unit} pt ={" "}
                        {line.qty * line.points_per_unit} pt
                      </div>
                      <button style={secondaryButtonStyle()} onClick={() => onRemoveCartLine(line.tempId)}>
                        Verwijderen
                      </button>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, fontWeight: 800, color: COLORS.navy }}>
                    Totaal: {currentOrderTotal} pt
                  </div>
                </>
              )}
            </div>
          </>
        ) : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Nieuwe werknemer", showNewEmployee, setShowNewEmployee)}
        {showNewEmployee ? (
          <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
            <div>
              <label>Voornaam</label>
              <input value={firstName} onChange={(event) => setFirstName(event.target.value)} style={inputStyle()} />
            </div>
            <div>
              <label>Achternaam</label>
              <input value={lastName} onChange={(event) => setLastName(event.target.value)} style={inputStyle()} />
            </div>
            <div>
              <label>Statuut</label>
              <select value={employeeStatus} onChange={(event) => setEmployeeStatus(event.target.value)} style={inputStyle()}>
                <option value="Arbeider">Arbeider</option>
                <option value="Bediende">Bediende</option>
              </select>
            </div>
            <button style={primaryButtonStyle()} onClick={onAddEmployee}>
              Werknemer toevoegen
            </button>
          </div>
        ) : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Zoek en filter werknemers", showEmployees, setShowEmployees, <span>{filteredEmployees.length} gevonden</span>)}
        {showEmployees ? (
          <>
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                marginBottom: 16,
              }}
            >
              <div>
                <label>Zoek op naam</label>
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} style={inputStyle()} />
              </div>
              <div>
                <label>Statuut</label>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle()}>
                  <option value="all">Alle statuten</option>
                  <option value="Arbeider">Arbeider</option>
                  <option value="Bediende">Bediende</option>
                </select>
              </div>
              <div>
                <label>Status</label>
                <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} style={inputStyle()}>
                  <option value="active">Alleen actief</option>
                  <option value="inactive">Alleen inactief</option>
                  <option value="all">Alles</option>
                </select>
              </div>
            </div>

            {filteredEmployees.map((employee) => (
              <div
                key={employee.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: `1px solid ${COLORS.border}`,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong>{employee.full_name}</strong> ({employee.status}) - budget {employee.budget} /
                  verbruikt {employee.spent} / saldo{" "}
                  <span style={{ fontWeight: 800, color: employee.remaining < 0 ? COLORS.dangerText : COLORS.text }}>
                    {employee.remaining}
                  </span>
                  {!employee.active ? " - inactief" : ""}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={secondaryButtonStyle()} onClick={() => setDetailEmployeeId(employee.id)}>
                    Detail / aanpassen
                  </button>
                  <button style={secondaryButtonStyle()} onClick={() => onToggleEmployee(employee)}>
                    {employee.active ? "Inactief zetten" : "Activeren"}
                  </button>
                </div>
              </div>
            ))}
          </>
        ) : null}
      </div>

      {detailEmployee ? (
        <div style={blockStyle()}>
          <h2 style={{ marginTop: 0, color: COLORS.navy }}>
            Werknemerdetail: {detailEmployee.full_name}
          </h2>

          <div style={{ display: "grid", gap: 12, maxWidth: 520, marginBottom: 20 }}>
            <div>
              <label>Naam aanpassen</label>
              <input
                value={editEmployeeName}
                onChange={(event) => setEditEmployeeName(event.target.value)}
                style={inputStyle()}
              />
            </div>
            <div>
              <label>Statuut aanpassen</label>
              <select
                value={editEmployeeStatus}
                onChange={(event) => setEditEmployeeStatus(event.target.value)}
                style={inputStyle()}
              >
                <option value="Arbeider">Arbeider</option>
                <option value="Bediende">Bediende</option>
              </select>
            </div>
            <button style={primaryButtonStyle()} onClick={onSaveEmployeeDetails}>
              Naam/statuut opslaan
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              marginBottom: 20,
            }}
          >
            <div><strong>Statuut:</strong> {detailEmployee.status}</div>
            <div><strong>Budget:</strong> {detailEmployee.budget}</div>
            <div><strong>Verbruikt:</strong> {detailEmployee.spent}</div>
            <div><strong>Saldo:</strong> {detailEmployee.remaining}</div>
          </div>

          <div style={{ maxWidth: 320, marginBottom: 20 }}>
            <label>Extra punten toevoegen</label>
            <input type="number" value={extraPointsInput} onChange={(event) => setExtraPointsInput(event.target.value)} style={inputStyle()} />
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button style={primaryButtonStyle()} onClick={onAddExtraPoints}>Opslaan</button>
              <button style={secondaryButtonStyle()} onClick={() => setDetailEmployeeId(null)}>Sluiten</button>
            </div>
          </div>

          <h3 style={{ color: COLORS.navy }}>Bestellingen</h3>
          {(ordersByEmployee[detailEmployee.id] || []).length === 0 ? (
            <div style={{ color: COLORS.muted }}>Geen bestellingen voor deze werknemer.</div>
          ) : (
            (ordersByEmployee[detailEmployee.id] || []).map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                lineLabel={lineLabel}
                onDeleteOrder={onDeleteOrder}
                dangerButtonStyle={dangerButtonStyle}
              />
            ))
          )}
        </div>
      ) : null}

      <div style={blockStyle()}>
        {sectionHeader("Catalogus", showCatalog, setShowCatalog)}
        {showCatalog ? (
          <>
            <div style={{ display: "grid", gap: 12, maxWidth: 420, marginBottom: 16 }}>
              <div>
                <label>Nieuw artikel</label>
                <input value={newItemName} onChange={(event) => setNewItemName(event.target.value)} style={inputStyle()} />
              </div>
              <div>
                <label>Punten</label>
                <input type="number" value={newItemPoints} onChange={(event) => setNewItemPoints(event.target.value)} style={inputStyle()} />
              </div>
              <button style={primaryButtonStyle()} onClick={onAddCatalogItem}>
                Artikel toevoegen
              </button>
            </div>

            {catalogItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: `1px solid ${COLORS.border}`,
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
        {sectionHeader("Voorraadbeheer", showStock, setShowStock, <span>{stockItems.length} regels</span>)}
        {showStock ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <button style={secondaryButtonStyle()} onClick={exportStockCsv}>
                Exporteer voorraad CSV
              </button>
            </div>

            {stockItems.map((stock) => (
              <div
                key={stock.id}
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "2fr 1fr 1fr 1fr auto auto auto",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: `1px solid ${COLORS.border}`,
                }}
              >
                <div>
                  <strong>{stock.item_name}</strong>
                  {stock.variant ? ` - ${stock.variant}` : ""}
                  {!stock.active ? " - inactief" : ""}
                </div>
                <div>Maat: {stock.size || "-"}</div>
                <div style={stockStyle(stock)}>
                  Voorraad: {stock.quantity}
                  {Number(stock.quantity || 0) <= Number(stock.minimum_quantity || 2) ? " ⚠" : ""}
                </div>
                <div>Min: {stock.minimum_quantity}</div>
                <button style={secondaryButtonStyle()} onClick={() => onChangeStockQuantity(stock, -1)}>-1</button>
                <button style={secondaryButtonStyle()} onClick={() => onChangeStockQuantity(stock, 1)}>+1</button>
                <button style={secondaryButtonStyle()} onClick={() => onToggleStockItem(stock)}>
                  {stock.active ? "Deactiveren" : "Activeren"}
                </button>
              </div>
            ))}
          </>
        ) : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Bestellingen per werknemer", showOrders, setShowOrders)}
        {showOrders ? (
          <>
            {employeesWithStats.map((employee) => {
              const orders = ordersByEmployee[employee.id] || [];
              if (orders.length === 0) return null;

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
                  {orders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      lineLabel={lineLabel}
                      onDeleteOrder={onDeleteOrder}
                      dangerButtonStyle={dangerButtonStyle}
                    />
                  ))}
                </div>
              );
            })}
          </>
        ) : null}
      </div>

      <div style={blockStyle()}>
        {sectionHeader("Export", showExport, setShowExport)}
        {showExport ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={secondaryButtonStyle()} onClick={exportEmployeesCsv}>Exporteer werknemers CSV</button>
            <button style={secondaryButtonStyle()} onClick={exportOrdersCsv}>Exporteer bestellingen CSV</button>
            <button style={secondaryButtonStyle()} onClick={exportStockCsv}>Exporteer voorraad CSV</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OrderCard({ order, lineLabel, onDeleteOrder, dangerButtonStyle }) {
  return (
    <div
      style={{
        borderTop: "1px solid #d9dee8",
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
      <ul>
        {(order.lines || []).map((line) => (
          <li key={line.id}>
            {lineLabel(line)} - {line.qty} x {line.points_per_unit} pt
          </li>
        ))}
      </ul>
      <button style={dangerButtonStyle()} onClick={() => onDeleteOrder(order)}>
        Bestelling verwijderen en voorraad terugzetten
      </button>
    </div>
  );
}
