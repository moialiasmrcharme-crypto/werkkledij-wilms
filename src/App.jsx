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

  const activeCatalogItems = useMemo(
    () => catalogItems.filter((item) => item.active),
    [catalogItems]
  );

  const employeesWithStats = useMemo(() => {
    return employees.map((employee) => {
      const basePoints = employee.status === "Arbeider" ? 300 : 40;
      const extraPoints = employee.extra_points || 0;
      const budget = Math.min(500, basePoints + extraPoints);

      const orders = ordersByEmployee[employee.id] || [];
      const spent = orders.reduce((sum, order) => {
        return (
          sum +
          (order.lines || []).reduce(
            (lineSum, line) => lineSum + line.qty * line.points_per_unit,
            0
          )
        );
      }, 0);

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
    return employeesWithStats.find((employee) => employee.id === detailEmployeeId) || null;
  }, [employeesWithStats, detailEmployeeId]);

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
    };
  }, [employeesWithStats, ordersByEmployee]);

  async function loadEmployees() {
    setLoadingEmployees(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("id", { ascending: true });

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

    setEmployees((prev) => [...prev, ...(data || [])]);
    setFirstName("");
    setLastName("");
    setStatus("Arbeider");
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

    if (detailEmployeeId === id) {
      setDetailEmployeeId(id);
    }
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
  }

  async function onCreateOrder() {
    if (!selectedEmployeeId || !selectedItemId || qty <= 0) return;

    setSavingOrder(true);
    setErrorMessage("");

    const item = catalogItems.find(
      (catalogItem) => String(catalogItem.id) === String(selectedItemId)
    );

    if (!item) {
      setSavingOrder(false);
      return;
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          employee_id: Number(selectedEmployeeId),
          order_date: new Date().toISOString().slice(0, 10),
          status: "Besteld",
          note: "",
        },
      ])
      .select();

    if (orderError) {
      console.log("CREATE ORDER ERROR:", orderError);
      setSavingOrder(false);
      setErrorMessage("Bestelling kon niet opgeslagen worden.");
      return;
    }

    const order = orderData?.[0];
    if (!order) {
      setSavingOrder(false);
      return;
    }

    const { data: lineData, error: lineError } = await supabase
      .from("order_lines")
      .insert([
        {
          order_id: order.id,
          item_id: item.id,
          qty: Number(qty),
          points_per_unit: item.points,
        },
      ])
      .select();

    setSavingOrder(false);

    if (lineError) {
      console.log("CREATE ORDER LINE ERROR:", lineError);
      setErrorMessage("Bestellijn kon niet opgeslagen worden.");
      return;
    }

    setOrdersByEmployee((prev) => {
      const employeeId = Number(selectedEmployeeId);
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
  }

  function getItemName(itemId) {
    const item = catalogItems.find((catalogItem) => catalogItem.id === itemId);
    return item ? item.name : `Artikel ${itemId}`;
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
      </div>

      <div style={blockStyle()}>
        <h2 style={{ marginTop: 0 }}>Nieuwe werknemer</h2>

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
      </div>

      <div style={blockStyle()}>
        <h2 style={{ marginTop: 0 }}>Nieuwe bestelling</h2>

        <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
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

          <div>
            <button onClick={onCreateOrder} disabled={savingOrder}>
              {savingOrder ? "Opslaan..." : "Bestelling opslaan"}
            </button>
          </div>
        </div>
      </div>

      <div style={blockStyle()}>
        <h2 style={{ marginTop: 0 }}>Nieuw artikel</h2>

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
      </div>

      <div style={blockStyle()}>
        <h2 style={{ marginTop: 0 }}>Zoek en filter werknemers</h2>

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
      </div>

      <div style={blockStyle()}>
        <h2 style={{ marginTop: 0 }}>Werknemers</h2>
        {loadingEmployees ? <div>Werknemers laden...</div> : null}
        <div style={{ marginBottom: 12 }}>
          {filteredEmployees.length} werknemer(s) gevonden
        </div>

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
              <strong>Verbruikt:</strong> {selectedEmployee.spent}
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
            <div>Geen bestellingen voor deze werknemer.</div>
          ) : (
            (ordersByEmployee[selectedEmployee.id] || []).map((order) => (
              <div
                key={order.id}
                style={{
                  borderTop: "1px solid #eee",
                  paddingTop: 10,
                  marginTop: 10,
                }}
              >
                <div>
                  <strong>Datum:</strong> {order.order_date}
                </div>
                <div>
                  <strong>Status:</strong> {order.status}
                </div>
                <ul>
                  {(order.lines || []).map((line) => (
                    <li key={line.id}>
                      {getItemName(line.item_id)} - {line.qty} x{" "}
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
        <h2 style={{ marginTop: 0 }}>Catalogus</h2>
        {loadingCatalog ? <div>Catalogus laden...</div> : null}
        {catalogItems.map((item) => (
          <div key={item.id}>
            {item.name} ({item.points} pt){!item.active ? " - inactief" : ""}
          </div>
        ))}
      </div>

      <div style={blockStyle()}>
        <h2 style={{ marginTop: 0 }}>Bestellingen per werknemer</h2>
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
                  }}
                >
                  <div>
                    <strong>Datum:</strong> {order.order_date}
                  </div>
                  <div>
                    <strong>Status:</strong> {order.status}
                  </div>
                  <ul>
                    {(order.lines || []).map((line) => (
                      <li key={line.id}>
                        {getItemName(line.item_id)} - {line.qty} x{" "}
                        {line.points_per_unit} pt
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
