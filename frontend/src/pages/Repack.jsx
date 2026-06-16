import { useEffect, useState, useRef } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { repackApi, productsApi, rawMaterialsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/repack.css';

// Currency format for UI
const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n || 0);

export default function Repack() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [products, setProducts] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [history, setHistory] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [reportData, setReportData] = useState(null);

  // Load everything
  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, recRes, histRes, repRes, rmRes] = await Promise.all([
        productsApi.list({ limit: 1000 }),
        repackApi.listRecipes(),
        repackApi.list(),
        repackApi.report(),
        rawMaterialsApi.list({ limit: 1000 })
      ]);
      setProducts(prodRes.data.products || []);
      setRecipes(recRes.data || []);
      setHistory(histRes.data || []);
      setReportData(repRes.data || null);
      setRawMaterials(rmRes.data.materials || []);
    } catch (err) {
      console.error(err);
      toast('Failed to load repack data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page repack-theme">
      <div className="page-header">
        <div>
          <h1 className="page-title">Repacking Management</h1>
          <p className="page-subtitle">Convert raw materials into finished packages and track production costs.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={loadData}>🔄 Refresh Data</button>
          {user?.role !== 'staff' && (
            <button className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }} onClick={() => setActiveTab('create')}>
              ⚙️ Create Repack Entry
            </button>
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="repack-tabs">
        <button className={`repack-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>📈 Dashboard</button>
        <button className={`repack-tab ${activeTab === 'recipes' ? 'active' : ''}`} onClick={() => setActiveTab('recipes')}>📋 Formula Master (Recipes)</button>
        <button className={`repack-tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>🛠️ Create Repack</button>
        <button className={`repack-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>📜 Repack History</button>
        <button className={`repack-tab ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>📑 Reports</button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'dashboard' && <RepackDashboard reportData={reportData} />}
      {activeTab === 'recipes' && <RepackRecipes recipes={recipes} products={products} onRefresh={loadData} />}
      {activeTab === 'create' && <RepackCreate recipes={recipes} products={products} rawMaterials={rawMaterials} onRefresh={loadData} setActiveTab={setActiveTab} />}
      {activeTab === 'history' && <RepackHistory history={history} onRefresh={loadData} />}
      {activeTab === 'reports' && <RepackReports reportData={reportData} />}
    </div>
  );
}

/* ============================================================================
   TAB: DASHBOARD
============================================================================ */
function RepackDashboard({ reportData }) {
  if (!reportData) return <div className="card">No report stats available</div>;
  const { metrics, charts } = reportData;

  return (
    <div>
      {/* Metrics Cards */}
      <div className="repack-dashboard-grid">
        <div className="repack-stat-card">
          <div className="repack-stat-label">Total Repack Orders</div>
          <div className="repack-stat-val">{metrics.totalOrders || 0}</div>
        </div>
        <div className="repack-stat-card">
          <div className="repack-stat-label">Today's Repacks</div>
          <div className="repack-stat-val">{metrics.todaysRepacks || 0}</div>
        </div>
        <div className="repack-stat-card">
          <div className="repack-stat-label">Raw Material Consumed</div>
          <div className="repack-stat-val" style={{ color: '#ef4444' }}>{fmt(metrics.rawMaterialConsumedVal)}</div>
        </div>
        <div className="repack-stat-card">
          <div className="repack-stat-label">Finished Goods Produced</div>
          <div className="repack-stat-val" style={{ color: '#22c55e' }}>{metrics.finishedGoodsProducedQty || 0}</div>
        </div>
        <div className="repack-stat-card">
          <div className="repack-stat-label">Total Production Cost</div>
          <div className="repack-stat-val">{fmt(metrics.repackTotalCost)}</div>
        </div>
        <div className="repack-stat-card">
          <div className="repack-stat-label">Pending Orders</div>
          <div className="repack-stat-val" style={{ color: '#f59e0b' }}>{metrics.pendingOrders || 0}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="repack-charts-grid">
        {/* Monthly Activity */}
        <div className="repack-chart-card">
          <div className="repack-chart-title">Monthly Production Volume & Value</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v, name) => name === 'consumption' ? fmt(v) : v} />
              <Legend />
              <Bar dataKey="production" fill="#ff9800" name="Finished Qty Produced" />
              <Bar dataKey="count" fill="#3b82f6" name="Repacks Conducted" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Material Consumption split */}
        <div className="repack-chart-card">
          <div className="repack-chart-title">Raw Material Consumption (Top 5 Qty)</div>
          {charts.materialConsumptionChart?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.materialConsumptionChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={110} style={{ fontSize: '0.8rem' }} />
                <Tooltip />
                <Bar dataKey="value" fill="#ef4444" name="Qty Consumed" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              No material consumption logs yet.
            </div>
          )}
        </div>

        {/* Finished Goods Produced split */}
        <div className="repack-chart-card">
          <div className="repack-chart-title">Finished Goods Output (Top 5 Qty)</div>
          {charts.finishedProductionChart?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.finishedProductionChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={110} style={{ fontSize: '0.8rem' }} />
                <Tooltip />
                <Bar dataKey="value" fill="#22c55e" name="Qty Produced" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              No finished goods produced yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   TAB: FORMULA MASTER (RECIPES)
============================================================================ */
function RepackRecipes({ recipes, products, onRefresh }) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [showModal, setShowModal] = useState(false);
  const [editRecipe, setEditRecipe] = useState(null);
  
  // Form States
  const [recipeName, setRecipeName] = useState('');
  const [finishedProductId, setFinishedProductId] = useState('');
  const [finishedQty, setFinishedQty] = useState(1);
  const [unit, setUnit] = useState('pcs');
  const [wastagePercent, setWastagePercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('active');
  const [materials, setMaterials] = useState([{ productId: '', qty: 1 }]);

  const openAdd = () => {
    setEditRecipe(null);
    setRecipeName('');
    setFinishedProductId('');
    setFinishedQty(1);
    setUnit('pcs');
    setWastagePercent(0);
    setNotes('');
    setStatus('active');
    setMaterials([{ productId: '', qty: 1 }]);
    setShowModal(true);
  };

  const openEdit = (recipe) => {
    setEditRecipe(recipe);
    setRecipeName(recipe.recipeName);
    setFinishedProductId(recipe.finishedProductId);
    setFinishedQty(recipe.finishedQty);
    setUnit(recipe.unit);
    setWastagePercent(recipe.wastagePercent);
    setNotes(recipe.notes || '');
    setStatus(recipe.status);
    setMaterials(recipe.materials.map(m => ({ productId: m.productId, qty: m.qty })));
    setShowModal(true);
  };

  const handleAddIngredient = () => {
    setMaterials([...materials, { productId: '', qty: 1 }]);
  };

  const handleRemoveIngredient = (index) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const handleIngredientChange = (index, field, value) => {
    const updated = [...materials];
    updated[index][field] = value;
    setMaterials(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!recipeName || !finishedProductId || materials.some(m => !m.productId || m.qty <= 0)) {
      return toast('Please fill in all recipe fields and ingredient lines', 'warning');
    }

    try {
      const payload = { recipeName, finishedProductId, finishedQty, unit, wastagePercent, notes, status, materials };
      if (editRecipe) {
        await repackApi.updateRecipe(editRecipe.id, payload);
        toast('Recipe updated successfully', 'success');
      } else {
        await repackApi.createRecipe(payload);
        toast('Recipe created successfully', 'success');
      }
      setShowModal(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || 'Error saving recipe', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recipe?')) return;
    try {
      await repackApi.removeRecipe(id);
      toast('Recipe deleted successfully', 'success');
      onRefresh();
    } catch (err) {
      console.error(err);
      toast('Error deleting recipe', 'error');
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Recipe Formulas</h3>
        {user?.role !== 'staff' && (
          <button className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }} onClick={openAdd}>
            + Add Recipe Formula
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Recipe Name</th>
              <th>Finished Output Item</th>
              <th>Yield Qty</th>
              <th>Ingredients Count</th>
              <th>Wastage %</th>
              <th>Status</th>
              {user?.role !== 'staff' && <th style={{ textAlign: 'center' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {recipes.length > 0 ? (
              recipes.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.recipeName}</strong></td>
                  <td>{r.finishedProduct ? `${r.finishedProduct.name} (${r.finishedProduct.sku})` : 'N/A'}</td>
                  <td>{r.finishedQty} {r.unit}</td>
                  <td>{r.materials?.length || 0} items</td>
                  <td>{r.wastagePercent}%</td>
                  <td>
                    <span className={`badge ${r.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {r.status}
                    </span>
                  </td>
                  {user?.role !== 'staff' && (
                    <td style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>✏️ Edit</button>
                      {isAdmin && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>🗑️ Delete</button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  No recipe formulas defined. Click "+ Add Recipe Formula" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignState: 'center', justifyState: 'center' }}>
          <div className="modal" style={{ maxWidth: '650px', width: '90%', margin: 'auto' }}>
            <div className="modal-header">
              <h2>{editRecipe ? 'Edit Recipe Formula' : 'Add Recipe Formula'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label">Recipe Name *</label>
                  <input className="form-control" placeholder="e.g. ABC Malt 500g Pack" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Finished Output Product *</label>
                  <select className="form-control" value={finishedProductId} onChange={(e) => {
                    setFinishedProductId(e.target.value);
                    const prod = products.find(p => String(p.id) === String(e.target.value));
                    if (prod) setUnit(prod.unit);
                  }} required>
                    <option value="">Select Finished Product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label">Yield Qty *</label>
                  <input type="number" min="0.01" step="0.01" className="form-control" value={finishedQty} onChange={(e) => setFinishedQty(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Unit</label>
                  <input className="form-control" value={unit} onChange={(e) => setUnit(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Wastage %</label>
                  <input type="number" min="0" max="100" step="0.1" className="form-control" value={wastagePercent} onChange={(e) => setWastagePercent(e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Notes</label>
                <textarea rows="2" className="form-control" placeholder="Production notes or packaging specs..." value={notes} onChange={(e) => setNotes(e.target.value)}></textarea>
              </div>

              {editRecipe && (
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Status</label>
                  <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong>Recipe Ingredients (Raw Materials) *</strong>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddIngredient}>+ Add Ingredient</button>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {materials.map((mat, index) => (
                    <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                      <select style={{ flex: 2 }} className="form-control" value={mat.productId} onChange={(e) => handleIngredientChange(index, 'productId', e.target.value)} required>
                        <option value="">Select Raw Item...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.sku}) [Stock: {p.stock} {p.unit}]</option>
                        ))}
                      </select>
                      <input style={{ flex: 1 }} type="number" min="0.0001" step="0.0001" className="form-control" placeholder="Qty needed" value={mat.qty} onChange={(e) => handleIngredientChange(index, 'qty', e.target.value)} required />
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveIngredient(index)} disabled={materials.length <= 1}>&times;</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }}>Save Recipe</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   TAB: CREATE REPACK ENTRY
============================================================================ */
function RepackCreate({ recipes, products, rawMaterials, onRefresh, setActiveTab }) {
  const { toast } = useToast();
  
  const [productId, setProductId] = useState('');
  const [packSizeId, setPackSizeId] = useState('');
  const [qtyToProduce, setQtyToProduce] = useState(1);
  const [laborCost, setLaborCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('completed');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));

  // Find selected product & pack size
  const selectedProduct = products.find(p => String(p.id || p._id) === String(productId));
  const availablePackSizes = selectedProduct ? (selectedProduct.packSizes || []) : [];
  const selectedPack = availablePackSizes.find(ps => String(ps.id || ps._id) === String(packSizeId));

  // Find pouch and label matching selected pack size name in raw materials (e.g. "500g")
  const packName = selectedPack ? selectedPack.packName : '';
  const pouch = selectedPack ? rawMaterials.find(rm => 
    ['Pouches', 'Packaging Materials'].includes(rm.category) && 
    rm.name.toLowerCase().includes(packName.toLowerCase())
  ) : null;

  const label = selectedPack ? rawMaterials.find(rm => 
    ['Labels'].includes(rm.category) && 
    rm.name.toLowerCase().includes(packName.toLowerCase())
  ) : null;

  const packQuantity = Number(qtyToProduce) || 0;
  const weightToConsume = selectedPack ? (packQuantity * Number(selectedPack.weightInGrams)) / 1000 : 0;

  // Stock Validation
  const isBulkLow = selectedProduct ? (Number(selectedProduct.stock) < weightToConsume) : false;
  const isPouchLow = pouch ? (Number(pouch.stock) < packQuantity) : false;
  const isLabelLow = label ? (Number(label.stock) < packQuantity) : false;
  const hasStockWarning = isBulkLow || isPouchLow || isLabelLow;

  // Costs
  const bulkCost = selectedProduct ? (weightToConsume * Number(selectedProduct.purchasePrice || 0)) : 0;
  const pouchCost = pouch ? (Number(pouch.purchasePrice || 0) * packQuantity) : 0;
  const labelCost = label ? (Number(label.purchasePrice || 0) * packQuantity) : 0;
  const packingMaterialCost = pouchCost + labelCost;
  const totalCost = bulkCost + packingMaterialCost + Number(laborCost || 0) + Number(otherCost || 0);
  const costPerUnit = packQuantity > 0 ? (totalCost / packQuantity) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productId || !packSizeId || qtyToProduce <= 0) {
      return toast('Please select product, pack size and quantity', 'warning');
    }

    if (status === 'completed' && hasStockWarning) {
      return toast('Insufficient stock for bulk product or packaging materials.', 'error');
    }

    try {
      const payload = {
        productId,
        packSizeId,
        qtyToProduce,
        laborCost,
        packingMaterialCost,
        otherCost,
        notes,
        status,
        date
      };
      await repackApi.create(payload);
      toast(`Repack entry saved successfully as ${status}`, 'success');
      onRefresh();
      setActiveTab('history');
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || 'Error saving repack entry', 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
      <div className="card">
        <h3>Create Repack Entry</h3>
        <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label className="form-label">Select Bulk Product *</label>
              <select className="form-control" value={productId} onChange={(e) => { setProductId(e.target.value); setPackSizeId(''); }} required>
                <option value="">Choose Product...</option>
                {products.filter(p => p.supplier !== 'repack').map(p => (
                  <option key={p.id || p._id} value={p.id || p._id}>{p.name} (Bulk Stock: {Number(p.stock).toFixed(2)} {p.unit})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Select Target Pack Size *</label>
              <select className="form-control" value={packSizeId} onChange={(e) => setPackSizeId(e.target.value)} required disabled={!productId}>
                <option value="">Choose Pack Size...</option>
                {availablePackSizes.map(ps => (
                  <option key={ps.id || ps._id} value={ps.id || ps._id}>{ps.packName} ({ps.weightInGrams}g) [Stock: {ps.stock} packs]</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label className="form-label">Number of Packs to Produce *</label>
              <input type="number" min="1" step="1" className="form-control" value={qtyToProduce} onChange={(e) => setQtyToProduce(e.target.value)} required />
              {selectedPack && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Will deduct: <strong>{weightToConsume.toFixed(2)} Kg</strong> from bulk stock
                </span>
              )}
            </div>
            <div>
              <label className="form-label">Date *</label>
              <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label className="form-label">Status *</label>
              <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)} required>
                <option value="completed">Completed (Deducts stock immediately)</option>
                <option value="pending">Pending (Planned order, stock remains unchanged)</option>
              </select>
            </div>
            <div>
              <label className="form-label">Labor Cost (₹)</label>
              <input type="number" min="0" step="0.01" className="form-control" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label className="form-label">Other Overhead Cost (₹)</label>
              <input type="number" min="0" step="0.01" className="form-control" value={otherCost} onChange={(e) => setOtherCost(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Production Notes / Details</label>
            <textarea rows="2" className="form-control" placeholder="Repack details or comments..." value={notes} onChange={(e) => setNotes(e.target.value)}></textarea>
          </div>

          {/* Raw Materials Required Calculator */}
          {selectedPack && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1.5rem' }}>
              <h4 style={{ marginBottom: '0.75rem' }}>Required Assets & Packaging (Auto-Calculated)</h4>
              
              {hasStockWarning && status === 'completed' && (
                <div className="repack-warning-banner" style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  ⚠️ <strong>Insufficient Stock Warning:</strong> You do not have enough stock of bulk product or matching packaging materials. Please restock or save as <strong>Pending</strong>.
                </div>
              )}

              {!pouch && !label && (
                <div style={{ padding: '0.5rem', background: '#fffbeb', color: '#b45309', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.8rem' }}>
                  ℹ️ No matching packaging materials (Pouch/Label) found in inventory for size <strong>{selectedPack.packName}</strong>. Deductions will apply to bulk product only.
                </div>
              )}

              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>Required Quantity</th>
                    <th>Available Stock</th>
                    <th>Material Cost</th>
                    <th style={{ textAlign: 'center' }}>Stock Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProduct && (
                    <tr>
                      <td>{selectedProduct.name} <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>({selectedProduct.sku} - Bulk Stock)</span></td>
                      <td>{weightToConsume.toFixed(2)} Kg</td>
                      <td>{Number(selectedProduct.stock).toFixed(2)} Kg</td>
                      <td>{fmt(bulkCost)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${isBulkLow ? 'badge-danger' : 'badge-success'}`}>
                          {isBulkLow ? 'Low Stock' : 'Available'}
                        </span>
                      </td>
                    </tr>
                  )}
                  {pouch && (
                    <tr>
                      <td>{pouch.name} <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>({pouch.materialCode} - Pouch)</span></td>
                      <td>{packQuantity} pcs</td>
                      <td>{Number(pouch.stock).toFixed(2)} pcs</td>
                      <td>{fmt(pouchCost)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${isPouchLow ? 'badge-danger' : 'badge-success'}`}>
                          {isPouchLow ? 'Low Stock' : 'Available'}
                        </span>
                      </td>
                    </tr>
                  )}
                  {label && (
                    <tr>
                      <td>{label.name} <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>({label.materialCode} - Label)</span></td>
                      <td>{packQuantity} pcs</td>
                      <td>{Number(label.stock).toFixed(2)} pcs</td>
                      <td>{fmt(labelCost)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${isLabelLow ? 'badge-danger' : 'badge-success'}`}>
                          {isLabelLow ? 'Low Stock' : 'Available'}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('dashboard')}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }} disabled={status === 'completed' && hasStockWarning}>
              Save Repack
            </button>
          </div>

        </form>
      </div>

      {/* Cost Calculator Sidebar panel */}
      <div className="card" style={{ position: 'sticky', top: '1.5rem' }}>
        <h3>Repack Costing Summary</h3>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0' }}>
          Real-time cost breakdown based on formula raw material values and additional labor/packing costs.
        </div>
        
        <div className="repack-cost-summary-box">
          <div className="repack-cost-row">
            <span>Bulk Product cost:</span>
            <strong>{fmt(bulkCost)}</strong>
          </div>
          <div className="repack-cost-row">
            <span>Packaging materials:</span>
            <strong>{fmt(packingMaterialCost)}</strong>
          </div>
          <div className="repack-cost-row">
            <span>Labor & operations:</span>
            <strong>{fmt(Number(laborCost))}</strong>
          </div>
          <div className="repack-cost-row">
            <span>Other overheads:</span>
            <strong>{fmt(Number(otherCost))}</strong>
          </div>
          <div className="repack-cost-row total">
            <span>Total Cost:</span>
            <span>{fmt(totalCost)}</span>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', padding: '1rem', background: 'var(--bg-page)', borderRadius: 'var(--radius)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Cost Per Pack</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--brand-primary)', marginTop: '0.25rem' }}>
            {fmt(costPerUnit)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Calculated for producing {packQuantity} packs
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   TAB: REPACK HISTORY
============================================================================ */
function RepackHistory({ history, onRefresh }) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [detailEntry, setDetailEntry] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const viewDetails = async (id) => {
    try {
      const res = await repackApi.get(id);
      setDetailEntry(res.data);
      setShowModal(true);
    } catch {
      toast('Failed to load repack entry details', 'error');
    }
  };

  const handleAction = async (id, currentStatus) => {
    if (currentStatus === 'pending') {
      if (!window.confirm('Mark this repack order as Completed? This will deduct raw material stock and add finished goods stock.')) return;
      try {
        await repackApi.update(id, { status: 'completed' });
        toast('Repack entry marked as Completed successfully', 'success');
        onRefresh();
      } catch (err) {
        toast(err.response?.data?.message || 'Failed to complete repack order', 'error');
      }
    } else if (currentStatus === 'completed') {
      if (!window.confirm('Are you sure you want to REVERSE this completed repack entry? This will return raw materials to stock and deduct finished goods. This action cannot be undone.')) return;
      try {
        await repackApi.remove(id); // DELETE on completed entry triggers reversal
        toast('Repack entry reversed successfully', 'success');
        onRefresh();
        if (showModal) setShowModal(false);
      } catch (err) {
        toast(err.response?.data?.message || 'Failed to reverse repack entry', 'error');
      }
    }
  };

  const handleDeletePending = async (id) => {
    if (!window.confirm('Delete this pending repack order?')) return;
    try {
      await repackApi.remove(id); // DELETE on pending deletes it completely
      toast('Pending repack deleted successfully', 'success');
      onRefresh();
      if (showModal) setShowModal(false);
    } catch {
      toast('Failed to delete repack', 'error');
    }
  };

  const handlePrint = (entry) => {
    const printContent = document.getElementById('repack-print-area').innerHTML;
    const originalContent = document.body.innerHTML;
    
    // Simple popup window print style
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>Repack Order #${entry.repackNumber}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header-bar { border-bottom: 2px solid #ff9800; padding-bottom: 10px; margin-bottom: 20px; }
            .cost-box { float: right; width: 250px; background: #fafafa; border: 1px dashed #ff9800; padding: 10px; margin-top: 20px; }
          </style>
        </head>
        <body onload="window.print();window.close();">
          ${printContent}
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="card">
      <h3>Repack Entry Logs</h3>

      <div className="table-wrap" style={{ marginTop: '1rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Repack No</th>
              <th>Date</th>
              <th>Recipe Used</th>
              <th>Finished Output Produced</th>
              <th>Quantity Produced</th>
              <th>Total Cost</th>
              <th>User</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.length > 0 ? (
              history.map((h) => (
                <tr key={h.id}>
                  <td><strong>{h.repackNumber}</strong></td>
                  <td>{new Date(h.date).toLocaleDateString()}</td>
                  <td>{h.recipe ? h.recipe.recipeName : (h.packSize ? `Repack to ${h.packSize.packName}` : 'Custom Repack')}</td>
                  <td>{h.finishedProduct ? `${h.finishedProduct.name} (${h.finishedProduct.sku})` : 'N/A'}</td>
                  <td>{h.packSize ? `${h.qtyToProduce} packs (${h.packSize.packName})` : `${h.qtyToProduce} ${h.finishedProduct?.unit || 'pcs'}`}</td>
                  <td>{fmt(h.totalCost)}</td>
                  <td>{h.createdBy ? h.createdBy.name : 'System'}</td>
                  <td>
                    <span className={`badge ${
                      h.status === 'completed' ? 'badge-success' : 
                      h.status === 'pending' ? 'badge-warning' : 'badge-danger'
                    }`}>
                      {h.status}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => viewDetails(h.id)}>👁️ View</button>
                    {h.status === 'pending' && user?.role !== 'staff' && (
                      <button className="btn btn-primary btn-sm" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }} onClick={() => handleAction(h.id, 'pending')}>
                        ⚡ Complete
                      </button>
                    )}
                    {h.status === 'completed' && isAdmin && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleAction(h.id, 'completed')}>
                        ↩️ Reverse
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  No repack entry records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Details View Modal */}
      {showModal && detailEntry && (
        <div className="modal-overlay" style={{ display: 'flex', alignState: 'center', justifyState: 'center' }}>
          <div className="modal" style={{ maxWidth: '600px', width: '90%', margin: 'auto' }}>
            <div className="modal-header">
              <h2>Repack Details: {detailEntry.repackNumber}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            
            <div id="repack-print-area" className="repack-print-body">
              <div className="header-bar">
                <h3 style={{ margin: 0, color: '#ff9800' }}>AO Core ERP - Repack Receipt</h3>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>Order Reference: {detailEntry.repackNumber}</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                <div>
                  <p><strong>Date:</strong> {new Date(detailEntry.date).toLocaleString()}</p>
                  <p><strong>Status:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{detailEntry.status}</span></p>
                  <p><strong>Formula Used:</strong> {detailEntry.recipe ? detailEntry.recipe.recipeName : (detailEntry.packSize ? `Direct Pack Size Repack (${detailEntry.packSize.packName})` : 'N/A')}</p>
                </div>
                <div>
                  <p><strong>Finished Output:</strong> {detailEntry.finishedProduct?.name}</p>
                  <p><strong>SKU Code:</strong> {detailEntry.finishedProduct?.sku}</p>
                  <p><strong>Quantity Produced:</strong> {detailEntry.packSize ? `${detailEntry.qtyToProduce} packs (${detailEntry.packSize.packName})` : `${detailEntry.qtyToProduce} ${detailEntry.finishedProduct?.unit}`}</p>
                </div>
              </div>

              <h4>Consumed Materials Snapshot</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ border: '1px solid #ddd', padding: '6px' }}>Raw Item</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px' }}>SKU</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right' }}>Qty Consumed</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right' }}>Cost Per Unit</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right' }}>Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {detailEntry.materials?.map(m => (
                    <tr key={m.id}>
                      <td style={{ border: '1px solid #ddd', padding: '6px' }}>{m.product?.name || 'N/A'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '6px' }}>{m.product?.sku || 'N/A'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right' }}>{m.qtyUsed} {m.product?.unit}</td>
                      <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right' }}>{fmt(m.unitCost)}</td>
                      <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right' }}>{fmt(m.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="cost-box" style={{ fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyState: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Raw Materials Cost:</span>
                  <strong>{fmt(detailEntry.rawMaterialCost)}</strong>
                </div>
                <div style={{ display: 'flex', justifyState: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Packaging Materials:</span>
                  <strong>{fmt(detailEntry.packingMaterialCost)}</strong>
                </div>
                <div style={{ display: 'flex', justifyState: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Labor Overheads:</span>
                  <strong>{fmt(detailEntry.laborCost)}</strong>
                </div>
                <div style={{ display: 'flex', justifyState: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Other Overheads:</span>
                  <strong>{fmt(detailEntry.otherCost)}</strong>
                </div>
                <div style={{ display: 'flex', justifyState: 'space-between', borderTop: '1px solid #ddd', paddingTop: '0.4rem', marginTop: '0.4rem', fontSize: '0.95rem' }}>
                  <span><strong>Total Production Cost:</strong></span>
                  <strong>{fmt(detailEntry.totalCost)}</strong>
                </div>
                <div style={{ display: 'flex', justifyState: 'space-between', marginTop: '0.25rem', color: '#ff9800' }}>
                  <span><strong>Cost Per Unit:</strong></span>
                  <strong>{fmt(detailEntry.costPerUnit)} / unit</strong>
                </div>
              </div>
              
              <div style={{ clear: 'both', marginTop: '1.5rem', fontSize: '0.85rem' }}>
                <p><strong>Notes / Description:</strong> {detailEntry.notes || '—'}</p>
                <p><strong>Logged By:</strong> {detailEntry.createdBy?.name || 'System'}</p>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
              <button type="button" className="btn btn-secondary" onClick={() => handlePrint(detailEntry)}>🖨️ Print Receipt</button>
              {detailEntry.status === 'pending' && user?.role !== 'staff' && (
                <>
                  <button type="button" className="btn btn-danger" onClick={() => handleDeletePending(detailEntry.id)}>🗑️ Delete Draft</button>
                  <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }} onClick={() => handleAction(detailEntry.id, 'pending')}>⚡ Complete Order</button>
                </>
              )}
              {detailEntry.status === 'completed' && isAdmin && (
                <button type="button" className="btn btn-danger" onClick={() => handleAction(detailEntry.id, 'completed')}>↩️ Reverse Repack</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   TAB: REPACK REPORTS
============================================================================ */
function RepackReports({ reportData }) {
  const [reportTab, setReportTab] = useState('daily');

  if (!reportData) return <div className="card">No report details generated</div>;
  const { reports } = reportData;

  // Export grids to CSV format (fully offline excel helper)
  const handleExportCSV = (tab) => {
    let data = [];
    let headers = [];
    let filename = '';

    if (tab === 'daily') {
      filename = 'repack_cost_analysis_report.csv';
      headers = ['repackNumber', 'date', 'recipeName', 'productName', 'qtyProduced', 'totalCost', 'costPerUnit', 'status'];
      data = reports.costAnalysisReport;
    } else if (tab === 'product') {
      filename = 'repack_product_wise_report.csv';
      headers = ['productName', 'sku', 'unit', 'totalProduced', 'totalCost', 'avgCostPerUnit', 'timesRepacked'];
      data = reports.productWiseRepackReport;
    } else if (tab === 'materials') {
      filename = 'repack_material_consumption_report.csv';
      headers = ['date', 'repackNumber', 'recipeName', 'materialName', 'materialSku', 'qtyUsed', 'unitCost', 'totalCost'];
      data = reports.matConsumptionReport;
    }

    const csvRows = [];
    // Header line
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));

    // Data lines
    data.forEach(row => {
      const values = headers.map(header => {
        let val = row[header];
        if (header === 'date') val = new Date(val).toLocaleDateString();
        const strVal = val !== undefined && val !== null ? String(val) : '';
        return `"${strVal.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button className={`btn btn-sm ${reportTab === 'daily' ? 'btn-primary' : 'btn-secondary'}`} style={reportTab === 'daily' ? { backgroundColor: '#ff9800', borderColor: '#ff9800' } : {}} onClick={() => setReportTab('daily')}>📊 Cost & Daily Analytics</button>
          <button className={`btn btn-sm ${reportTab === 'product' ? 'btn-primary' : 'btn-secondary'}`} style={reportTab === 'product' ? { backgroundColor: '#ff9800', borderColor: '#ff9800' } : {}} onClick={() => setReportTab('product')}>📦 Product Wise Summary</button>
          <button className={`btn btn-sm ${reportTab === 'materials' ? 'btn-primary' : 'btn-secondary'}`} style={reportTab === 'materials' ? { backgroundColor: '#ff9800', borderColor: '#ff9800' } : {}} onClick={() => setReportTab('materials')}>🌾 Material Consumption</button>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => handleExportCSV(reportTab)}>📥 Export Report to Excel (CSV)</button>
      </div>

      {/* Report views */}
      {reportTab === 'daily' && (
        <div>
          <h4>Repack Production Cost Analysis</h4>
          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Repack Entry</th>
                  <th>Date</th>
                  <th>Formula</th>
                  <th>Finished Item</th>
                  <th>Qty Produced</th>
                  <th>Raw Mat Cost</th>
                  <th>Labor Cost</th>
                  <th>Overhead Cost</th>
                  <th>Total cost</th>
                  <th>Cost / Unit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.costAnalysisReport?.length > 0 ? (
                  reports.costAnalysisReport.map((row, idx) => (
                    <tr key={idx}>
                      <td><strong>{row.repackNumber}</strong></td>
                      <td>{new Date(row.date).toLocaleDateString()}</td>
                      <td>{row.recipeName}</td>
                      <td>{row.productName}</td>
                      <td>{row.qtyProduced}</td>
                      <td>{fmt(row.rawMaterialCost)}</td>
                      <td>{fmt(row.laborCost)}</td>
                      <td>{fmt(row.packingMaterialCost + row.otherCost)}</td>
                      <td><strong>{fmt(row.totalCost)}</strong></td>
                      <td style={{ color: '#ff9800', fontWeight: 'bold' }}>{fmt(row.costPerUnit)}</td>
                      <td><span className={`badge ${row.status === 'completed' ? 'badge-success' : row.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>{row.status}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: '1.5rem' }}>No costing logs found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportTab === 'product' && (
        <div>
          <h4>Product-Wise Production Output Summary</h4>
          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>Stock Unit</th>
                  <th>Total Produced Qty</th>
                  <th>Total Cost Invested</th>
                  <th>Average Cost Per Unit</th>
                  <th>Production Runs</th>
                </tr>
              </thead>
              <tbody>
                {reports.productWiseRepackReport?.length > 0 ? (
                  reports.productWiseRepackReport.map((row, idx) => (
                    <tr key={idx}>
                      <td><strong>{row.productName}</strong></td>
                      <td>{row.sku}</td>
                      <td>{row.unit}</td>
                      <td>{row.totalProduced}</td>
                      <td>{fmt(row.totalCost)}</td>
                      <td style={{ color: '#ff9800', fontWeight: 'bold' }}>{fmt(row.avgCostPerUnit)}</td>
                      <td>{row.timesRepacked} times</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem' }}>No production records found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportTab === 'materials' && (
        <div>
          <h4>Raw Material Consumption History</h4>
          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Repack No</th>
                  <th>Formula</th>
                  <th>Raw Ingredient Consumed</th>
                  <th>SKU</th>
                  <th>Quantity Consumed</th>
                  <th>Asset Value Per Unit</th>
                  <th>Total Cost Value</th>
                </tr>
              </thead>
              <tbody>
                {reports.matConsumptionReport?.length > 0 ? (
                  reports.matConsumptionReport.map((row, idx) => (
                    <tr key={idx}>
                      <td>{new Date(row.date).toLocaleDateString()}</td>
                      <td><strong>{row.repackNumber}</strong></td>
                      <td>{row.recipeName}</td>
                      <td>{row.materialName}</td>
                      <td>{row.materialSku}</td>
                      <td>{row.qtyUsed}</td>
                      <td>{fmt(row.unitCost)}</td>
                      <td><strong>{fmt(row.totalCost)}</strong></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem' }}>No material consumption logs found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
