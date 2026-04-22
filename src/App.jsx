import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

export default function App() {
  const [employees, setEmployees] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [status, setStatus] = useState("Arbeider");
  const [savingEmployee, setSavingEmployee] = useState(false);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [qty, setQty] = useState(1);

  const [newItemName, setNewItemName] = useState("");
  const [newItemPoints, setNewItemPoints] = useState("");

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

      setEmployees(data || []);
    }

    async function loadCatalog() {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("*")
        .order("id", { ascending: true });

      if (error) {
        console.log("LOAD CATALOG ERROR:", error);
        return;
      }

      setCatalogItems(data || []);
    }

    loadEmployees();
    loadCatalog();
  }, []);

  async function onAddEmployee() {
    if (!firstName.trim() || !lastName.trim()) return;

    setSavingEmployee(true);

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
      return;
    }

    setEmployees((prev) => [...prev, data[0]]);
    setFirstName("");
    setLastName("");
    setStatus("Arbeider");
  }

  async function onDeactivateEmployee(id) {
    const { error } = await supabase
      .from("employees")
      .update({ active: false })
      .eq("id", id);

    if (error) {
      console.log("DEACTIVATE EMPLOYEE ERROR:", error);
      return;
    }

    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, active: false } : e))
    );
  }

  async function onAddCatalogItem() {
    if (!newItemName.trim()) return;

    const payload = {
      name: newItemName.trim(),
      points: Number(newItemPoints) || 0,
      active: true,
    };

    const { data, error } = await supabase
      .from("catalog_items")
      .insert([payload])
      .select();

    if (error) {
      console.log("ADD CATALOG ITEM ERROR:", error);
      return;
    }

    setCatalogItems((prev) => [...prev, data[0]]);
    setNewItemName("");
    setNewItemPoints("");
  }

  async function onCreateOrder() {
    if (!selectedEmployeeId || !selectedItemId || qty <= 0) return;

    const item = catalogItems.find(
      (c) => String(c.id) === String(selectedItemId)
    );
    if (!item) return;

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
      return;
    }

    const order = orderData[0];

    const { error: lineError } = await supabase
      .from("order_lines")
      .insert([
        {
          order_id: order.id,
          item_id: item.id,
          qty: qty,
          points_per_unit: item.points,
        },
      ]);

    if (lineError) {
      console.log("CREATE ORDER LINE ERROR:", lineError);
      return;
    }

    alert("Bestelling opgeslagen");
    setSelectedEmployeeId("");
    setSelectedItemId("");
    setQty(1);
  }

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "Arial, sans-serif",
        maxWidth: 1000,
        margin: "0 auto",
      }}
    >
      <h1>Werkkledij Wilms (Admin)</h1>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          background: "#f8fafc",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Nieuwe werknemer</h2>

        <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
          <div>
            <label>Voornaam</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }}
            />
          </div>

          <div>
            <label>Achternaam</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }}
            />
          </div>

          <div>
            <label>Statuut</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }}
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

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          background: "#f8fafc",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Nieuwe bestelling</h2>

        <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
          <div>
            <label>Werknemer</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }}
            >
              <option value="">Kies werknemer</option>
              {employees
                .filter((e) => e.active)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label>Artikel</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }}
            >
              <option value="">Kies artikel</option>
              {catalogItems
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.points} pt)
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
              style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }}
            />
          </div>

          <div>
            <button onClick={onCreateOrder}>Bestelling opslaan</button>
          </div>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          background: "#f8fafc",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Nieuw artikel</h2>

        <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
          <div>
            <label>Artikelnaam</label>
            <input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }}
            />
          </div>

          <div>
            <label>Punten</label>
            <input
              type="number"
              value={newItemPoints}
              onChange={(e) => setNewItemPoints(e.target.value)}
              style={{ display: "block", width: "100%", padding: 10, marginTop: 4 }}
            />
          </div>

          <div>
            <button onClick={onAddCatalogItem}>Artikel toevoegen</button>
          </div>
        </div>
      </div>

      <h2>Werknemers</h2>
      {employees.map((e) => (
        <div
          key={e.id}
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
            <strong>{e.full_name}</strong> ({e.status})
            {!e.active && <span> - inactief</span>}
          </div>

          {e.active ? (
            <button onClick={() => onDeactivateEmployee(e.id)}>
              Inactief zetten
            </button>
          ) : null}
        </div>
      ))}

      <h2 style={{ marginTop: 32 }}>Catalogus</h2>
      {catalogItems.map((c) => (
        <div key={c.id}>
          {c.name} ({c.points} pt)
        </div>
      ))}
    </div>
  );
}
