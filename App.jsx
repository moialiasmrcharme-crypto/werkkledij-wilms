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

const initialEmployees = [
  { id: 1, firstName: 'Mark', lastName: 'Meeus', fullName: 'Meeus Mark', status: 'Bediende', basePoints: 40, extraPoints: 20, importedSpent: 60, importedRemaining: 0, orders: [{ id: 101, date: '2026-02-10', status: 'Geïmporteerd', items: [{ itemId: 1, qty: 1 }, { itemId: 11, qty: 1 }] }] },
  { id: 2, firstName: 'An', lastName: 'Peeters', fullName: 'Peeters An', status: 'Arbeider', basePoints: 300, extraPoints: 0, importedSpent: 210, importedRemaining: 90, orders: [{ id: 201, date: '2026-01-15', status: 'Geïmporteerd', items: [{ itemId: 3, qty: 2 }, { itemId: 9, qty: 1 }] }] },
  { id: 3, firstName: 'Tom', lastName: 'Janssens', fullName: 'Janssens Tom', status: 'Arbeider', basePoints: 300, extraPoints: 30, importedSpent: 80, importedRemaining: 250, orders: [{ id: 301, date: '2026-04-05', status: 'In aanvraag', items: [{ itemId: 5, qty: 1 }] }] },
]

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return 0
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
  const basePoints = employee.basePoints ?? (employee.status === 'Arbeider' ? 300 : 40)
  const budget = basePoints + (employee.extraPoints || 0)
  const spent = employee.importedSpent ?? calcSpent(employee.orders)
  const remaining = employee.importedRemaining ?? (budget - spent)
  return { ...employee, basePoints, budget, spent, remaining }
}

function parseEmployeesFromWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets['INVOER']
  if (!sheet) throw new Error("Werkblad 'INVOER' niet gevonden")
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  const employees = rows
    .filter((row) => row['Achternaam'] || row['Voornaam'])
    .map((row, index) => {
      const status = row['Statuut'] || 'Bediende'
      const extraPoints = toNumber(row['EXTRA punten'])
      const basePoints = status === 'Arbeider' ? 300 : 40
      const orders = catalog
        .map((item) => ({ itemId: item.id, qty: toNumber(row[item.excelHeader]) }))
        .filter((line) => line.qty > 0)

      return {
        id: index + 1,
        firstName: String(row['Voornaam'] || '').trim(),
        lastName: String(row['Achternaam'] || '').trim(),
        fullName: String(row['Naam + Voornaam'] || `${row['Achternaam'] || ''} ${row['Voornaam'] || ''}`).trim(),
        status,
        basePoints,
        extraPoints,
        importedSpent: row['Verbruikt'] === '' ? null : toNumber(row['Verbruikt']),
        importedRemaining: row['Resterend'] === '' ? null : toNumber(row['Resterend']),
        orders: orders.length ? [{ id: 9000 + index, date: '2026-01-01', status: 'Geïmporteerd uit Excel', items: orders }] : [],
      }
    })

  return { employees, rowCount: employees.length }
}

function euroStyleCard(title, value, subtitle) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statTitle}>{title}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statSubtitle}>{subtitle}</div>
    </div>
  )
}


function LoginScreen({ employees, onLogin }) {
  const [role, setRole] = useState('employee')
  const [employeeId, setEmployeeId] = useState(String(employees[0]?.id || '1'))

  return (
    <div style={styles.page}>
      <div style={styles.loginWrap}>
        <div>
          <div style={styles.badgeDark}>Prototype PWA</div>
          <h1 style={styles.heroTitle}>Werkkledijportaal</h1>
          <p style={styles.heroText}>Mobiele webapp voor werknemers en beheerder, met Excel-import op basis van jullie huidige structuur.</p>
          <div style={styles.installCard}>
            <div style={styles.installTitle}>Op iPhone gebruiken</div>
            <div style={styles.installText}>Na hosting open je de link in Safari en kies je Deel → Zet op beginscherm.</div>
          </div>
        </div>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Aanmelden</h2>
          <div style={styles.formGroup}>
            <label>Rol</label>
            <select style={styles.input} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="employee">Werknemer</option>
              <option value="admin">Beheerder</option>
            </select>
          </div>
          {role === 'employee' && (
            <div style={styles.formGroup}>
              <label>Werknemer</label>
              <select style={styles.input} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
              </select>
            </div>
          )}
          <button style={styles.primaryButton} onClick={() => onLogin({ role, employeeId: role === 'employee' ? employeeId : null })}>Open app</button>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [employees, setEmployees] = useState(initialEmployees)
  const [session, setSession] = useState(null)
  const [importMessage, setImportMessage] = useState('')
  const [importError, setImportError] = useState('')
  const [selectedItemId, setSelectedItemId] = useState(String(catalog[0].id))
  const [selectedQty, setSelectedQty] = useState(1)
  const [extraPoints, setExtraPoints] = useState('')

  const enrichedEmployees = useMemo(() => employees.map(calcEmployee), [employees])
  const selectedEmployee = enrichedEmployees.find((employee) => String(employee.id) === String(session?.employeeId)) || enrichedEmployees[0]

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      const parsed = parseEmployeesFromWorkbook(buffer)
      setEmployees(parsed.employees)
      setImportMessage(`${file.name} ingelezen: ${parsed.rowCount} werknemers geladen.`)
      setImportError('')
      if (session?.role === 'employee') {
        setSession({ role: 'employee', employeeId: String(parsed.employees[0]?.id || '1') })
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import mislukt')
      setImportMessage('')
    }
    event.target.value = ''
  }

  const createOrder = () => {
    if (!selectedEmployee) return
    const item = getItem(Number(selectedItemId))
    const addedPoints = (item?.points || 0) * selectedQty
    setEmployees((current) => current.map((employee) => {
      if (employee.id !== selectedEmployee.id) return employee
      const currentSpent = employee.importedSpent ?? calcSpent(employee.orders)
      const currentRemaining = employee.importedRemaining ?? (employee.basePoints + employee.extraPoints - currentSpent)
      return {
        ...employee,
        importedSpent: currentSpent + addedPoints,
        importedRemaining: currentRemaining - addedPoints,
        orders: [
          { id: Date.now(), date: new Date().toISOString().slice(0, 10), status: 'In aanvraag', items: [{ itemId: Number(selectedItemId), qty: selectedQty }] },
          ...(employee.orders || []),
        ],
      }
    }))
  }

  const addAdminExtraPoints = (employeeId) => {
    const points = toNumber(extraPoints)
    if (!points) return
    setEmployees((current) => current.map((employee) => {
      if (employee.id !== employeeId) return employee
      const nextExtra = (employee.extraPoints || 0) + points
      const currentSpent = employee.importedSpent ?? calcSpent(employee.orders)
      return {
        ...employee,
        extraPoints: nextExtra,
        importedRemaining: employee.basePoints + nextExtra - currentSpent,
      }
    }))
    setExtraPoints('')
  }

  if (!session) {
    return (
      <LoginScreen employees={enrichedEmployees} onLogin={setSession} />
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.topLabel}>Mobiele webapp</div>
            <h1 style={styles.topTitle}>Werkkledijportaal</h1>
            <div style={styles.topSubtitle}>{session.role === 'admin' ? 'Beheerderoverzicht' : `Werknemer: ${selectedEmployee?.fullName || ''}`}</div>
          </div>
          <button style={styles.secondaryButton} onClick={() => setSession(null)}>Afmelden</button>
        </div>

        {session.role === 'admin' && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Excel import</h2>
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} />
            {importMessage ? <div style={styles.success}>{importMessage}</div> : null}
            {importError ? <div style={styles.error}>{importError}</div> : null}
          </div>
        )}

        {session.role === 'employee' && selectedEmployee && (
          <>
            <div style={styles.grid3}>
              {euroStyleCard('Saldo', `${selectedEmployee.remaining} punten`, `Budget ${selectedEmployee.budget}`)}
              {euroStyleCard('Verbruikt', selectedEmployee.spent, 'Op basis van import + nieuwe registraties')}
              {euroStyleCard('Statuut', selectedEmployee.status, `Extra punten ${selectedEmployee.extraPoints}`)}
            </div>

            <div style={styles.twoCol}>
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>Nieuwe bestelling</h2>
                <div style={styles.formGroup}>
                  <label>Artikel</label>
                  <select style={styles.input} value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)}>
                    {catalog.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.points} pt)</option>)}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label>Aantal</label>
                  <input style={styles.input} type="number" min="1" value={selectedQty} onChange={(e) => setSelectedQty(Math.max(1, Number(e.target.value) || 1))} />
                </div>
                <button style={styles.primaryButton} onClick={createOrder}>Bestelling registreren</button>
              </div>

              <div style={styles.card}>
                <h2 style={styles.cardTitle}>Catalogus</h2>
                <div style={styles.catalogList}>
                  {catalog.map((item) => (
                    <div key={item.id} style={styles.catalogItem}>
                      <span>{item.name}</span>
                      <strong>{item.points} pt</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Mijn historiek</h2>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Items</th>
                      <th>Status</th>
                      <th>Punten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployee.orders.map((order) => {
                      const total = order.items.reduce((sum, line) => sum + (getItem(line.itemId)?.points || 0) * line.qty, 0)
                      return (
                        <tr key={order.id}>
                          <td>{order.date}</td>
                          <td>{order.items.map((line) => `${getItem(line.itemId)?.name} x${line.qty}`).join(', ')}</td>
                          <td>{order.status}</td>
                          <td>{total}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {session.role === 'admin' && (
          <>
            <div style={styles.grid4}>
              {euroStyleCard('Werknemers', enrichedEmployees.length, 'Actieve records')}
              {euroStyleCard('Totaal budget', enrichedEmployees.reduce((s, e) => s + e.budget, 0), 'Basis + extra punten')}
              {euroStyleCard('Verbruikt', enrichedEmployees.reduce((s, e) => s + e.spent, 0), 'Alle werknemers')}
              {euroStyleCard('Resterend', enrichedEmployees.reduce((s, e) => s + e.remaining, 0), 'Beschikbaar saldo')}
            </div>

            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Werknemers</h2>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Naam</th>
                      <th>Statuut</th>
                      <th>Budget</th>
                      <th>Verbruikt</th>
                      <th>Resterend</th>
                      <th>Extra punten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrichedEmployees.map((employee) => (
                      <tr key={employee.id}>
                        <td>{employee.fullName}</td>
                        <td>{employee.status}</td>
                        <td>{employee.budget}</td>
                        <td>{employee.spent}</td>
                        <td>{employee.remaining}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input style={{ ...styles.input, minWidth: 80 }} type="number" value={extraPoints} onChange={(e) => setExtraPoints(e.target.value)} />
                            <button style={styles.secondaryButton} onClick={() => addAdminExtraPoints(employee.id)}>Toevoegen</button>
                          </div>
                        </td>
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

const styles = {
  page: { minHeight: '100vh', background: '#f1f5f9', padding: 16 },
  container: { maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 20 },
  loginWrap: { maxWidth: 1100, margin: '0 auto', minHeight: '100vh', display: 'grid', alignItems: 'center', gap: 24, gridTemplateColumns: '1.2fr 0.8fr' },
  heroTitle: { margin: '12px 0 8px', fontSize: 44, lineHeight: 1.05 },
  heroText: { margin: 0, color: '#475569', fontSize: 18, maxWidth: 640 },
  badgeDark: { display: 'inline-block', padding: '8px 12px', borderRadius: 999, background: '#0f172a', color: 'white', fontSize: 13, fontWeight: 600 },
  installCard: { marginTop: 24, borderRadius: 24, background: 'linear-gradient(135deg, #0f172a, #334155)', color: 'white', padding: 20, maxWidth: 560 },
  installTitle: { fontWeight: 700, marginBottom: 8 },
  installText: { color: '#cbd5e1' },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', borderRadius: 28, padding: 24, boxShadow: '0 6px 20px rgba(15,23,42,0.06)' },
  topLabel: { fontSize: 13, color: '#64748b' },
  topTitle: { margin: '4px 0', fontSize: 32 },
  topSubtitle: { color: '#64748b' },
  card: { background: 'white', borderRadius: 28, padding: 24, boxShadow: '0 6px 20px rgba(15,23,42,0.06)' },
  cardTitle: { margin: '0 0 16px', fontSize: 22 },
  grid3: { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, 1fr)' },
  grid4: { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(4, 1fr)' },
  twoCol: { display: 'grid', gap: 20, gridTemplateColumns: '1fr 1fr' },
  statCard: { background: 'white', borderRadius: 24, padding: 20, boxShadow: '0 6px 20px rgba(15,23,42,0.06)' },
  statTitle: { color: '#64748b', fontSize: 14 },
  statValue: { fontSize: 30, fontWeight: 700, marginTop: 6 },
  statSubtitle: { color: '#64748b', fontSize: 12, marginTop: 6 },
  formGroup: { display: 'grid', gap: 8, marginBottom: 14 },
  input: { width: '100%', padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: 16, background: 'white' },
  primaryButton: { border: 0, background: '#0f172a', color: 'white', padding: '12px 16px', borderRadius: 16, cursor: 'pointer', fontWeight: 600 },
  secondaryButton: { border: '1px solid #cbd5e1', background: 'white', color: '#0f172a', padding: '10px 14px', borderRadius: 16, cursor: 'pointer' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  catalogList: { display: 'grid', gap: 10 },
  catalogItem: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 16 },
  success: { marginTop: 12, padding: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 16, color: '#065f46' },
  error: { marginTop: 12, padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, color: '#991b1b' },
}

const mediaStyle = document.createElement('style')
mediaStyle.innerHTML = `
  th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  @media (max-width: 900px) {
    .responsive-grid { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 840px) {
    body { font-size: 14px; }
  }
  @media (max-width: 760px) {
    div[style*="grid-template-columns: repeat(3, 1fr)"] { grid-template-columns: 1fr !important; }
    div[style*="grid-template-columns: repeat(4, 1fr)"] { grid-template-columns: 1fr 1fr !important; }
    div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
    div[style*="grid-template-columns: 1.2fr 0.8fr"] { grid-template-columns: 1fr !important; min-height: auto !important; padding: 24px 0; }
    h1 { font-size: 32px !important; }
  }
`
document.head.appendChild(mediaStyle)

export default App
