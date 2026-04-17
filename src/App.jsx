import React, { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'

const catalog = [
  { id: 1, name: 'Blauwe vest', points: 40, excelHeader: 'Blauwe vest - 40' },
  { id: 2, name: 'Bodywarmer', points: 40, excelHeader: 'Bodywarmer - 40' },
  { id: 3, name: 'Broek (lang)', points: 70, excelHeader: 'Broek (lang) - 70' },
  { id: 4, name: 'Fleece', points: 20, excelHeader: 'Fleece - 20' },
  { id: 5, name: 'Jas', points: 80, excelHeader: 'Jas - 80' },
  { id: 6, name: 'Korte short', points: 80, excelHeader: 'Korte short - 80' },
  { id: 7, name: 'Lange short', points: 50, excelHeader: 'Lange short - 50' },
  { id: 8, name: 'Polo', points: 0, excelHeader: 'Polo - 0' },
  { id: 9, name: 'Schoenen', points: 70, excelHeader: 'Schoenen - 70' },
  { id: 10, name: 'Sokken (1 paar)', points: 10, excelHeader: 'Sokken (1 paar) - 10' },
  { id: 11, name: 'Sweater', points: 20, excelHeader: 'Sweater - 20' },
  { id: 12, name: 'T-shirt', points: 0, excelHeader: 'T-shirt - 0' },
  { id: 13, name: 'T-shirt premium', points: 1, excelHeader: 'T-shirt - 1' },
]

const demoEmployees = [
  { id: 1, fullName: 'Meeus Mark', status: 'Bediende', basePoints: 40, extraPoints: 20, importedSpent: 60, importedRemaining: 0, orders: [{ id: 1, date: '2026-01-01', status: 'Geïmporteerd', items: [{ itemId: 1, qty: 1 }, { itemId: 11, qty: 1 }] }] },
  { id: 2, fullName: 'Peeters An', status: 'Arbeider', basePoints: 300, extraPoints: 0, importedSpent: 210, importedRemaining: 90, orders: [{ id: 2, date: '2026-01-01', status: 'Geïmporteerd', items: [{ itemId: 3, qty: 2 }, { itemId: 9, qty: 1 }] }] },
]

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value
  const parsed = Number(String(value).replace(',', '.').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function getItem(itemId) {
  return catalog.find((item) => item.id === itemId)
}

function calcSpent(orders = []) {
  return orders.reduce((total, order) => total + order.items.reduce((sum, line) => sum + (getItem(line.itemId)?.points || 0) * line.qty, 0), 0)
}

function calcEmployee(employee) {
  const budget = (employee.basePoints || 0) + (employee.extraPoints || 0)
  const spent = employee.importedSpent ?? calcSpent(employee.orders)
  const remaining = employee.importedRemaining ?? (budget - spent)
  return { ...employee, budget, spent, remaining }
}

function formatOrderItems(items) {
  return items.map((line) => `${getItem(line.itemId)?.name || 'Onbekend'} x${line.qty}`).join(', ')
}

function parseEmployeesFromWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets['INVOER']
  if (!sheet) throw new Error("Het werkblad 'INVOER' werd niet gevonden.")
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  const employees = rows
    .filter((row) => row['Achternaam'] || row['Voornaam'])
    .map((row, index) => {
      const status = row['Statuut'] || 'Bediende'
      const basePoints = status === 'Arbeider' ? 300 : 40
      const extraPoints = toNumber(row['EXTRA punten'])
      const orderItems = catalog.map((item) => ({ itemId: item.id, qty: toNumber(row[item.excelHeader]) })).filter((line) => line.qty > 0)
      const importedSpent = row['Verbruikt'] === '' ? null : toNumber(row['Verbruikt'])
      const importedRemaining = row['Resterend'] === '' ? null : toNumber(row['Resterend'])
      return {
        id: index + 1,
        fullName: String(row['Naam + Voornaam'] || `${row['Achternaam'] || ''} ${row['Voornaam'] || ''}`).trim(),
        status,
        basePoints,
        extraPoints,
        importedSpent,
        importedRemaining,
        orders: orderItems.length ? [{ id: `import-${index + 1}`, date: '2026-01-01', status: 'Geïmporteerd uit Excel', items: orderItems }] : [],
      }
    })
  return { employees, rowCount: employees.length }
}

const styles = {
  app: { minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'Arial, sans-serif' },
  wrap: { maxWidth: 1100, margin: '0 auto', padding: 16 },
  card: { background: '#fff', borderRadius: 18, padding: 18, boxShadow: '0 1px 8px rgba(0,0,0,0.08)', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 700, margin: '0 0 6px' },
  muted: { color: '#475569' },
  button: { border: 0, borderRadius: 12, padding: '12px 16px', background: '#0f172a', color: '#fff', cursor: 'pointer' },
  buttonLight: { border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 16px', background: '#fff', color: '#0f172a', cursor: 'pointer' },
  input: { width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', boxSizing: 'border-box' },
  select: { width: '100%', padding: 12, borderRadius: 12, border: '1px solid #cbd5e1', boxSizing: 'border-box', background: '#fff' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 },
  stat: { background: '#fff', borderRadius: 18, padding: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.08)' },
  statValue: { fontSize: 26, fontWeight: 700, margin: '6px 0' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 14 },
  td: { padding: '10px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 14, verticalAlign: 'top' },
  badge: { display: 'inline-block', padding: '4px 8px', borderRadius: 999, background: '#e2e8f0', fontSize: 12 },
}

function App() {
  const [session, setSession] = useState(null)
  const [employees, setEmployees] = useState(demoEmployees)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('1')
  const [importMeta, setImportMeta] = useState(null)
  const [importError, setImportError] = useState('')
  const [itemId, setItemId] = useState('1')
  const [qty, setQty] = useState(1)

  const enriched = useMemo(() => employees.map(calcEmployee), [employees])
  const selectedEmployee = enriched.find((employee) => String(employee.id) === String(selectedEmployeeId)) || enriched[0]
  const totals = useMemo(() => {
    const totalBudget = enriched.reduce((sum, e) => sum + e.budget, 0)
    const totalSpent = enriched.reduce((sum, e) => sum + e.spent, 0)
    return { totalBudget, totalSpent, totalRemaining: totalBudget - totalSpent }
  }, [enriched])

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = parseEmployeesFromWorkbook(await file.arrayBuffer())
      setEmployees(parsed.employees)
      setSelectedEmployeeId(String(parsed.employees[0]?.id || '1'))
      setImportMeta({ fileName: file.name, rowCount: parsed.rowCount })
      setImportError('')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import mislukt.')
    }
    event.target.value = ''
  }

  const addOrder = () => {
    setEmployees((current) => current.map((employee) => {
      if (String(employee.id) !== String(selectedEmployeeId)) return employee
      const added = (getItem(Number(itemId))?.points || 0) * qty
      const spent = employee.importedSpent ?? calcSpent(employee.orders)
      const remaining = employee.importedRemaining ?? ((employee.basePoints + employee.extraPoints) - spent)
      return {
        ...employee,
        importedSpent: spent + added,
        importedRemaining: remaining - added,
        orders: [{ id: Date.now(), date: new Date().toISOString().slice(0, 10), status: 'In aanvraag', items: [{ itemId: Number(itemId), qty }] }, ...(employee.orders || [])],
      }
    }))
  }

  if (!session) {
    return (
      <div style={styles.app}>
        <div style={styles.wrap}>
          <div style={{ ...styles.card, marginTop: 40 }}>
            <div style={{ ...styles.badge, marginBottom: 12 }}>PWA prototype</div>
            <h1 style={styles.title}>Werkkledij Wilms</h1>
            <p style={styles.muted}>Interne webapp voor ongeveer 200 werknemers. Werkt op pc en iPhone via Safari.</p>
            <div style={{ ...styles.grid2, marginTop: 18 }}>
              <div>
                <label>Rol</label>
                <select style={styles.select} defaultValue="employee" onChange={(e) => setSession({ role: e.target.value, employeeId: e.target.value === 'employee' ? selectedEmployeeId : null })}>
                  <option value="employee">Werknemer</option>
                  <option value="admin">Beheerder</option>
                </select>
              </div>
              <div>
                <label>Werknemer</label>
                <select style={styles.select} value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
                  {enriched.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button style={styles.button} onClick={() => setSession({ role: 'employee', employeeId: selectedEmployeeId })}>Open als werknemer</button>
              <button style={{ ...styles.buttonLight, marginLeft: 10 }} onClick={() => setSession({ role: 'admin', employeeId: null })}>Open als beheerder</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.app}>
      <div style={styles.wrap}>
        <div style={styles.card}>
          <h1 style={styles.title}>Werkkledij Wilms</h1>
          <p style={styles.muted}>{session.role === 'admin' ? 'Beheerderoverzicht' : `Ingelogd als ${selectedEmployee?.fullName || ''}`}</p>
          <div style={{ marginTop: 12 }}>
            <button style={styles.buttonLight} onClick={() => setSession(null)}>Afmelden</button>
          </div>
        </div>

        {session.role === 'admin' && (
          <>
            <div style={styles.grid3}>
              <div style={styles.stat}><div style={styles.muted}>Werknemers</div><div style={styles.statValue}>{enriched.length}</div></div>
              <div style={styles.stat}><div style={styles.muted}>Totaal budget</div><div style={styles.statValue}>{totals.totalBudget}</div></div>
              <div style={styles.stat}><div style={styles.muted}>Verbruikt</div><div style={styles.statValue}>{totals.totalSpent}</div></div>
              <div style={styles.stat}><div style={styles.muted}>Resterend</div><div style={styles.statValue}>{totals.totalRemaining}</div></div>
            </div>

            <div style={styles.card}>
              <h2>Excel import</h2>
              <p style={styles.muted}>Laad het werkblad INVOER uit jullie Excelbestand.</p>
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} />
              {importMeta && <p style={{ color: '#166534' }}>{importMeta.fileName} geladen. {importMeta.rowCount} werknemers ingelezen.</p>}
              {importError && <p style={{ color: '#b91c1c' }}>{importError}</p>}
            </div>

            <div style={styles.card}>
              <h2>Overzicht werknemers</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Naam</th>
                      <th style={styles.th}>Statuut</th>
                      <th style={styles.th}>Budget</th>
                      <th style={styles.th}>Verbruikt</th>
                      <th style={styles.th}>Resterend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enriched.map((employee) => (
                      <tr key={employee.id}>
                        <td style={styles.td}>{employee.fullName}</td>
                        <td style={styles.td}>{employee.status}</td>
                        <td style={styles.td}>{employee.budget}</td>
                        <td style={styles.td}>{employee.spent}</td>
                        <td style={styles.td}>{employee.remaining}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {session.role === 'employee' && selectedEmployee && (
          <>
            <div style={styles.grid3}>
              <div style={styles.stat}><div style={styles.muted}>Beschikbaar saldo</div><div style={styles.statValue}>{selectedEmployee.remaining}</div></div>
              <div style={styles.stat}><div style={styles.muted}>Budget</div><div style={styles.statValue}>{selectedEmployee.budget}</div></div>
              <div style={styles.stat}><div style={styles.muted}>Verbruikt</div><div style={styles.statValue}>{selectedEmployee.spent}</div></div>
            </div>

            <div style={styles.grid2}>
              <div style={styles.card}>
                <h2>Nieuwe bestelling</h2>
                <div style={{ marginBottom: 12 }}>
                  <label>Artikel</label>
                  <select style={styles.select} value={itemId} onChange={(e) => setItemId(e.target.value)}>
                    {catalog.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.points} pt)</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>Aantal</label>
                  <input style={styles.input} type="number" min="1" value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
                </div>
                <button style={styles.button} onClick={addOrder}>Bestelling registreren</button>
              </div>

              <div style={styles.card}>
                <h2>Catalogus</h2>
                <div style={{ maxHeight: 340, overflow: 'auto' }}>
                  {catalog.map((item) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <span>{item.name}</span>
                      <strong>{item.points} pt</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <h2>Mijn historiek</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Datum</th>
                      <th style={styles.th}>Items</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployee.orders.map((order) => (
                      <tr key={order.id}>
                        <td style={styles.td}>{order.date}</td>
                        <td style={styles.td}>{formatOrderItems(order.items)}</td>
                        <td style={styles.td}><span style={styles.badge}>{order.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default App
