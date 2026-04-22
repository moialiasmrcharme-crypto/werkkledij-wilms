import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

export default function App() {
  const [employees, setEmployees] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [status, setStatus] = useState("Arbeider");
  const [savingEmployee, setSavingEmployee] = useState(false);

  useEffect(() => {
    async function loadEmployees() {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("id", { ascending: true });

      if (error) {
        console.log(error);
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
        console.log(error);
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
      console.log(error);
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
      console.log(error);
      return;
    }

    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, active: false } : e))
    );
  }

  async function onAddCatalogItem(name, points) {
    if (!name) return;

    const { data, error } = await supabase
      .from("catalog_items")
      .insert([{ name, points, active: true }])
      .select();

    if (error) {
      console.log(error);
      return;
    }

    setCatalogItems((prev) => [...prev, data[0]]);
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif", maxWidth: 900, margin: "0 auto" }}>
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

      <button onClick={() => onAddCatalogItem("Nieuwe jas", 50)}>
        Artikel toevoegen
      </button>
    </div>
  );
}
