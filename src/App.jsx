import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

export default function App() {
  const [employees, setEmployees] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);

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

  async function onAddEmployee(firstName, lastName, status) {
    if (!firstName || !lastName) return;

    const { data, error } = await supabase
      .from("employees")
      .insert([{
        first_name: firstName,
        last_name: lastName,
        full_name: `${lastName} ${firstName}`,
        status,
        active: true,
        extra_points: 0
      }])
      .select();

    if (error) {
      console.log(error);
      return;
    }

    setEmployees((prev) => [...prev, data[0]]);
  }

  async function onDeactivateEmployee(id) {
    await supabase
      .from("employees")
      .update({ active: false })
      .eq("id", id);

    setEmployees((prev) =>
      prev.map((e) => e.id === id ? { ...e, active: false } : e)
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
    <div style={{ padding: 20 }}>
      <h1>Werkkledij Wilms (Admin)</h1>

      <h2>Werknemers</h2>
      {employees.map((e) => (
        <div key={e.id}>
          {e.full_name} ({e.status})
          {e.active ? (
            <button onClick={() => onDeactivateEmployee(e.id)}>Deactivate</button>
          ) : (
            <span> (inactief)</span>
          )}
        </div>
      ))}

      <h3>Nieuwe werknemer</h3>
      <button onClick={() => onAddEmployee("Test", "User", "Arbeider")}>
        Test werknemer toevoegen
      </button>

      <h2>Catalogus</h2>
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
