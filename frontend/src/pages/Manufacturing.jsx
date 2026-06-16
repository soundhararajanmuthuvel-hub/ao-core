import { useEffect, useState, useCallback } from 'react';
import { manufacturingApi, productsApi, rawMaterialsApi } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/manufacturing.css';

export default function Manufacturing({ defaultTab, initialProductId, initialQty, initialRecipeId }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(defaultTab || 'entries');
  const [loading, setLoading] = useState(true);
  
  const [recipes, setRecipes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);

  // Forms / Modals
  const [modalType, setModalType] = useState(null); // 'create_recipe', 'edit_recipe', 'view_entry'
  const [selectedEntry, setSelectedEntry] = useState(null);
  
  // Recipe Form State
  const [recipeForm, setRecipeForm] = useState({
    name: '',
    productId: '',
    yieldQty: 1.0,
    notes: '',
    materials: [{ rawMaterialId: '', qty: '' }],
  });

  // Manufacturing Run State
  const [runForm, setRunForm] = useState({
    recipeId: initialRecipeId || '',
    productId: initialProductId || '',
    qtyToProduce: initialQty || '',
    laborCost: 0,
    otherCost: 0,
    notes: '',
    productionMode: 'weight',
    packSizeId: '',
  });

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, entRes, prodRes, rmRes] = await Promise.all([
        manufacturingApi.listRecipes(),
        manufacturingApi.list(),
        productsApi.list({ limit: 1000 }),
        rawMaterialsApi.list({ limit: 1000 }),
      ]);
      setRecipes(recRes.data);
      setEntries(entRes.data);
      setProducts(prodRes.data.products);
      setRawMaterials(rmRes.data.materials);
    } catch {
      toast('Failed to load manufacturing data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    if (initialProductId || initialQty || initialRecipeId) {
      setRunForm(prev => ({
        ...prev,
        productId: initialProductId || prev.productId,
        qtyToProduce: initialQty || prev.qtyToProduce,
        recipeId: initialRecipeId || prev.recipeId,
        notes: 'Pre-filled from Manufacturing Planner',
      }));
    }
  }, [initialProductId, initialQty, initialRecipeId]);

  // Compute live costs and stock availability for a potential manufacturing run
  const computeRunDetails = () => {
    if (!runForm.qtyToProduce || runForm.qtyToProduce <= 0) return null;
    
    const qty = Number(runForm.qtyToProduce);
    let materialsList = [];
    let totalOutputWeight = qty;
    
    if (runForm.recipeId) {
      const recipe = recipes.find(r => r.id === Number(runForm.recipeId));
      if (!recipe) return null;
      
      const selectedProduct = products.find(p => p._id === recipe.productId || p.id === recipe.productId);
      const availablePackSizes = selectedProduct ? (selectedProduct.packSizes || []) : [];
      const selectedPack = availablePackSizes.find(ps => String(ps.id) === String(runForm.packSizeId));

      if (runForm.productionMode === 'pack') {
        if (!selectedPack) return null;
        totalOutputWeight = (Number(selectedPack.weightInGrams) * qty) / 1000;
      }

      const ingredientMultiplier = totalOutputWeight / Number(recipe.yieldQty || 1);
      const weightMultiplier = qty / Number(recipe.yieldQty || 1);

      materialsList = recipe.materials.map(m => {
        let needed;
        if (runForm.productionMode === 'pack') {
          const isPackaging = ['Packaging Materials', 'Labels', 'Pouches', 'Cartons', 'Bottles'].includes(m.rawMaterial?.category);
          needed = isPackaging ? qty : (Number(m.qty) * ingredientMultiplier);
        } else {
          needed = Number(m.qty) * weightMultiplier;
        }

        const available = Number(m.rawMaterial?.stock || 0);
        return {
          name: m.rawMaterial?.name,
          needed,
          available,
          unitCost: Number(m.rawMaterial?.purchasePrice || 0),
          isShortage: needed > available,
        };
      });
    }

    const rawMaterialCost = materialsList.reduce((sum, m) => sum + (m.needed * m.unitCost), 0);
    const totalCost = rawMaterialCost + Number(runForm.laborCost || 0) + Number(runForm.otherCost || 0);
    const costPerUnit = totalCost / qty;
    const hasShortage = materialsList.some(m => m.isShortage);

    return {
      materialsList,
      rawMaterialCost,
      totalCost,
      costPerUnit,
      hasShortage,
      totalOutputWeight,
    };
  };

  const runDetails = computeRunDetails();

  const handleCreateRecipe = async () => {
    try {
      if (modalType === 'edit_recipe') {
        await manufacturingApi.updateRecipe(recipeForm.id, recipeForm);
        toast('Formula updated successfully', 'success');
      } else {
        await manufacturingApi.createRecipe(recipeForm);
        toast('Formula created successfully', 'success');
      }
      setModalType(null);
      loadAllData();
    } catch (err) {
      toast(err.response?.data?.message || 'Save failed', 'error');
    }
  };

  const handleDeleteRecipe = async (id) => {
    if (!confirm('Are you sure you want to delete this manufacturing recipe?')) return;
    try {
      await manufacturingApi.removeRecipe(id);
      toast('Recipe deleted', 'success');
      loadAllData();
    } catch (err) {
      toast(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  const handleExecuteRun = async (e) => {
    e.preventDefault();
    if (runDetails?.hasShortage) {
      toast('Cannot execute run: Insufficient raw material stocks!', 'error');
      return;
    }
    try {
      await manufacturingApi.create(runForm);
      toast('Manufacturing run completed successfully! Product stock updated.', 'success');
      setRunForm({ recipeId: '', productId: '', qtyToProduce: '', laborCost: 0, otherCost: 0, notes: '', productionMode: 'weight', packSizeId: '' });
      setActiveTab('entries');
      loadAllData();
    } catch (err) {
      toast(err.response?.data?.message || 'Execution failed', 'error');
    }
  };

  const handleReverseEntry = async (id) => {
    if (!confirm('Reverse this production entry? This will return all consumed raw materials to stock and deduct finished goods.')) return;
    try {
      await manufacturingApi.reverse(id);
      toast('Production run reversed successfully.', 'success');
      loadAllData();
    } catch (err) {
      toast(err.response?.data?.message || 'Reversal failed', 'error');
    }
  };

  return (
    <div className="page mfg-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Manufacturing Operations</h1>
          <p className="page-subtitle">Formulate recipes, track production logs, and consume raw materials to produce finished goods.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => {
          setRecipeForm({ name: '', productId: '', yieldQty: 1.0, notes: '', materials: [{ rawMaterialId: '', qty: '' }] });
          setModalType('create_recipe');
        }}>
          + New Recipe Formula
        </button>
      </div>

      {/* Tabs */}
      <div className="mfg-tabs-bar">
        <button type="button" className={`mfg-tab-btn ${activeTab === 'entries' ? 'active' : ''}`} onClick={() => setActiveTab('entries')}>
          Production Runs (Logs)
        </button>
        <button type="button" className={`mfg-tab-btn ${activeTab === 'recipes' ? 'active' : ''}`} onClick={() => setActiveTab('recipes')}>
          Formula Master (Recipes)
        </button>
        <button type="button" className={`mfg-tab-btn ${activeTab === 'run' ? 'active' : ''}`} onClick={() => setActiveTab('run')}>
          ⚙️ Start Production Run
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {activeTab === 'entries' && (
            <div className="card table-wrap">
              <table className="data-table mfg-table">
                <thead>
                  <tr>
                    <th>Mfg Run #</th>
                    <th>Date</th>
                    <th>Product Yield</th>
                    <th>Recipe Formula</th>
                    <th>Total Cost</th>
                    <th>Cost/Unit</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((ent) => (
                    <tr key={ent.id || ent._id}>
                      <td><strong>{ent.mfgNumber}</strong></td>
                      <td>{new Date(ent.date || ent.createdAt).toLocaleDateString()}</td>
                      <td><strong>{ent.qtyToProduce}</strong> {ent.product?.unit} of {ent.product?.name}</td>
                      <td>{ent.recipe?.name || 'Manual Run'}</td>
                      <td>Rs. {Number(ent.totalCost).toFixed(2)}</td>
                      <td>Rs. {Number(ent.costPerUnit).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${ent.status === 'completed' ? 'badge-success' : ent.status === 'reversed' ? 'badge-danger' : 'badge-warning'}`}>
                          {ent.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSelectedEntry(ent); setModalType('view_entry'); }}>Details</button>{' '}
                        {ent.status === 'completed' && (
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => handleReverseEntry(ent.id || ent._id)}>Reverse</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', color: '#9ca3af' }}>No production entries logged yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'recipes' && (
            <div className="card table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Formula Name</th>
                    <th>Yield Product</th>
                    <th>Standard Yield Qty</th>
                    <th>Raw Materials Consumed</th>
                    <th>Notes</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recipes.map((rec) => (
                    <tr key={rec.id || rec._id}>
                      <td><strong>{rec.name}</strong></td>
                      <td>{rec.product?.name} ({rec.product?.sku})</td>
                      <td>{rec.yieldQty} {rec.product?.unit}</td>
                      <td>
                        <div style={{ fontSize: '0.8125rem' }}>
                          {rec.materials.map((m) => (
                            <div key={m.id || m._id}>
                              • {m.rawMaterial?.name}: <strong>{m.qty}</strong> {m.rawMaterial?.unit}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>{rec.notes || '-'}</td>
                      <td>
                        <span className={`badge ${rec.status === 'Active' ? 'badge-success' : 'badge-secondary'}`}>
                          {rec.status}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                          setRecipeForm({
                            id: rec.id || rec._id,
                            name: rec.name,
                            productId: rec.productId,
                            yieldQty: rec.yieldQty,
                            notes: rec.notes,
                            materials: rec.materials.map(m => ({ rawMaterialId: m.rawMaterialId, qty: m.qty })),
                          });
                          setModalType('edit_recipe');
                        }}>Edit</button>{' '}
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteRecipe(rec.id || rec._id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {recipes.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', color: '#9ca3af' }}>No recipe formulas built yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'run' && (
            <div className="rm-layout with-sidebar">
              <form className="card" onSubmit={handleExecuteRun}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Production Inputs</h2>
                
                <div className="form-group">
                  <label>Select Recipe Formula</label>
                  <select
                    className="form-control"
                    value={runForm.recipeId}
                    onChange={(e) => {
                      const recipe = recipes.find(r => r.id === Number(e.target.value));
                      setRunForm({
                        ...runForm,
                        recipeId: e.target.value,
                        productId: recipe ? recipe.productId : '',
                        packSizeId: '',
                      });
                    }}
                  >
                    <option value="">Select Recipe</option>
                    {recipes.filter(r => r.status === 'Active').map((r) => (
                      <option key={r.id || r._id} value={r.id || r._id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Production Mode</label>
                  <select
                    className="form-control"
                    value={runForm.productionMode}
                    onChange={(e) => setRunForm({ ...runForm, productionMode: e.target.value, packSizeId: '' })}
                  >
                    <option value="weight">By Weight (Bulk production)</option>
                    <option value="pack">By Pack Count (Pack size production)</option>
                  </select>
                </div>

                {runForm.productionMode === 'pack' && (
                  <div className="form-group">
                    <label>Select Target Pack Size</label>
                    <select
                      className="form-control"
                      value={runForm.packSizeId}
                      onChange={(e) => setRunForm({ ...runForm, packSizeId: e.target.value })}
                      required
                    >
                      <option value="">Choose Pack Size...</option>
                      {(() => {
                        const recipe = recipes.find(r => r.id === Number(runForm.recipeId));
                        const prod = products.find(p => p._id === recipe?.productId || p.id === recipe?.productId);
                        return (prod?.packSizes || []).map(ps => (
                          <option key={ps.id} value={ps.id}>{ps.packName} ({ps.weightInGrams}g)</option>
                        ));
                      })()}
                    </select>
                  </div>
                )}
 
                <div className="form-group">
                  <label>{runForm.productionMode === 'pack' ? 'Number of Packs to Produce' : 'Quantity to Produce (Kg)'}</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder={runForm.productionMode === 'pack' ? 'e.g. 500 packs' : 'e.g. 100 Kg'}
                    value={runForm.qtyToProduce}
                    onChange={(e) => setRunForm({ ...runForm, qtyToProduce: e.target.value })}
                    required
                  />
                </div>
 
                <div className="rm-grid-form">
                  <div className="form-group">
                    <label>Labor Cost (Rs.)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={runForm.laborCost}
                      onChange={(e) => setRunForm({ ...runForm, laborCost: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Overheads / Other Costs (Rs.)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={runForm.otherCost}
                      onChange={(e) => setRunForm({ ...runForm, otherCost: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Production Notes</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="E.g. Batch # or supervisor notes"
                    value={runForm.notes}
                    onChange={(e) => setRunForm({ ...runForm, notes: e.target.value })}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }} disabled={!runDetails || runDetails.hasShortage}>
                  🚀 Execute Production & Update Stocks
                </button>
              </form>

              <div>
                {runDetails ? (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Production Summary</h2>
                    
                    {runDetails.hasShortage && (
                      <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
                        ⚠️ SHORTAGE: Insufficient stock for one or more raw materials listed below.
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '0.875rem', color: '#4b5563', fontWeight: 600 }}>Raw Material Consumption</h3>
                      {runDetails.materialsList.map((m, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: m.isShortage ? '#fee2e2' : '#f9fafb', borderRadius: '6px', fontSize: '0.875rem' }}>
                          <span>{m.name}</span>
                          <span style={{ fontWeight: 600, color: m.isShortage ? '#ef4444' : '#111827' }}>
                            {m.needed.toFixed(2)} required (Stock: {m.available})
                          </span>
                        </div>
                      ))}
                    </div>

                    {runForm.productionMode === 'pack' && (
                      <div style={{ padding: '0.75rem', background: '#e0f2fe', color: '#0369a1', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
                        📦 Total Yield Output Weight: <strong>{runDetails.totalOutputWeight.toFixed(2)} Kg</strong>
                      </div>
                    )}

                    <div className="mfg-cost-grid">
                      <div className="mfg-cost-item">
                        <span>Ingredients Cost</span>
                        <span>Rs. {runDetails.rawMaterialCost.toFixed(2)}</span>
                      </div>
                      <div className="mfg-cost-item">
                        <span>Labor & Overheads</span>
                        <span>Rs. {(Number(runForm.laborCost) + Number(runForm.otherCost)).toFixed(2)}</span>
                      </div>
                      <div className="mfg-cost-item" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem' }}>
                        <span>Total Production Cost</span>
                        <span>Rs. {runDetails.totalCost.toFixed(2)}</span>
                      </div>
                      <div className="mfg-cost-item" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem' }}>
                        <span>Estimated Cost / {runForm.productionMode === 'pack' ? 'Pack' : 'Unit'}</span>
                        <span>Rs. {runDetails.costPerUnit.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card" style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>
                    Enter target quantity to view production costing details and stock checks.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal - Create/Edit Recipe */}
      {['create_recipe', 'edit_recipe'].includes(modalType) && (
        <Modal
          title={modalType === 'edit_recipe' ? 'Edit Formula Recipe' : 'Build Manufacturing Recipe'}
          onClose={() => setModalType(null)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleCreateRecipe}>Save Formula</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label>Formula/Recipe Name</label>
              <input
                type="text"
                className="form-control"
                value={recipeForm.name}
                onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
              />
            </div>
            <div className="rm-grid-form">
              <div className="form-group">
                <label>Yield Product</label>
                <select
                  className="form-control"
                  value={recipeForm.productId}
                  onChange={(e) => setRecipeForm({ ...recipeForm, productId: e.target.value })}
                >
                  <option value="">Select Finished Product</option>
                  {products.map((p) => <option key={p.id || p._id} value={p.id || p._id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Standard Yield Qty</label>
                <input
                  type="number"
                  className="form-control"
                  value={recipeForm.yieldQty}
                  onChange={(e) => setRecipeForm({ ...recipeForm, yieldQty: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Formula Notes</label>
              <textarea
                className="form-control"
                rows="2"
                value={recipeForm.notes}
                onChange={(e) => setRecipeForm({ ...recipeForm, notes: e.target.value })}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: 600 }}>Ingredients & Packaging Materials Required</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                  setRecipeForm({
                    ...recipeForm,
                    materials: [...recipeForm.materials, { rawMaterialId: '', qty: '' }],
                  });
                }}>+ Add Ingredient</button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {recipeForm.materials.map((mat, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      className="form-control"
                      value={mat.rawMaterialId}
                      onChange={(e) => {
                        const newMaterials = [...recipeForm.materials];
                        newMaterials[idx].rawMaterialId = e.target.value;
                        setRecipeForm({ ...recipeForm, materials: newMaterials });
                      }}
                    >
                      <option value="">Select Material</option>
                      {rawMaterials.map((rm) => <option key={rm.id || rm._id} value={rm.id || rm._id}>{rm.name} ({rm.materialCode})</option>)}
                    </select>
                    <input
                      type="number"
                      step="0.0001"
                      className="form-control"
                      placeholder="Qty required"
                      style={{ maxWidth: '140px' }}
                      value={mat.qty}
                      onChange={(e) => {
                        const newMaterials = [...recipeForm.materials];
                        newMaterials[idx].qty = e.target.value;
                        setRecipeForm({ ...recipeForm, materials: newMaterials });
                      }}
                    />
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => {
                      const newMaterials = recipeForm.materials.filter((_, mIdx) => mIdx !== idx);
                      setRecipeForm({ ...recipeForm, materials: newMaterials });
                    }}>X</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal - View Entry Details */}
      {modalType === 'view_entry' && selectedEntry && (
        <Modal
          title={`Mfg Order Details: ${selectedEntry.mfgNumber}`}
          onClose={() => setModalType(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
              <div><strong>Date:</strong> {new Date(selectedEntry.date || selectedEntry.createdAt).toLocaleString()}</div>
              <div><strong>Status:</strong> {selectedEntry.status.toUpperCase()}</div>
              <div><strong>Recipe Formula:</strong> {selectedEntry.recipe?.name || 'Manual Batch'}</div>
              <div><strong>Created By:</strong> {selectedEntry.createdBy?.name || 'System'}</div>
            </div>
 
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
              <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Produced Finished Product</h4>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>
                {selectedEntry.productionMode === 'pack' ? (
                  <>
                    <strong>{selectedEntry.qtyToProduce} packs</strong> of size <strong>{selectedEntry.packSize?.packName}</strong> ({selectedEntry.product?.name})
                    <br />
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Total yield weight: {((Number(selectedEntry.qtyToProduce) * Number(selectedEntry.packSize?.weightInGrams || 0)) / 1000).toFixed(2)} Kg</span>
                  </>
                ) : (
                  <>
                    <strong>{selectedEntry.qtyToProduce} {selectedEntry.product?.unit}</strong> of <strong>{selectedEntry.product?.name}</strong> ({selectedEntry.product?.sku})
                  </>
                )}
              </p>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
              <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Consumed Ingredients Snapshot</h4>
              <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                <thead>
                  <tr>
                    <th>Material Code</th>
                    <th>Material Name</th>
                    <th>Qty Used</th>
                    <th>Unit Cost</th>
                    <th>Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEntry.materials.map((m) => (
                    <tr key={m.id || m._id}>
                      <td>{m.rawMaterial?.materialCode}</td>
                      <td>{m.rawMaterial?.name}</td>
                      <td>{m.qtyUsed} {m.rawMaterial?.unit}</td>
                      <td>Rs. {Number(m.unitCost).toFixed(2)}</td>
                      <td>Rs. {Number(m.totalCost).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mfg-cost-grid" style={{ fontSize: '0.875rem' }}>
              <div className="mfg-cost-item">
                <span>Materials Total Cost</span>
                <span>Rs. {Number(selectedEntry.rawMaterialCost).toFixed(2)}</span>
              </div>
              <div className="mfg-cost-item">
                <span>Labor & Overheads</span>
                <span>Rs. {(Number(selectedEntry.laborCost) + Number(selectedEntry.otherCost)).toFixed(2)}</span>
              </div>
              <div className="mfg-cost-item" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem' }}>
                <span>Grand Total Cost</span>
                <span>Rs. {Number(selectedEntry.totalCost).toFixed(2)}</span>
              </div>
              <div className="mfg-cost-item" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem' }}>
                <span>Unit Cost</span>
                <span>Rs. {Number(selectedEntry.costPerUnit).toFixed(2)}</span>
              </div>
            </div>

            {selectedEntry.notes && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', fontSize: '0.875rem' }}>
                <strong>Supervisor Notes:</strong>
                <p style={{ margin: '0.25rem 0 0 0', fontStyle: 'italic' }}>{selectedEntry.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
