import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { manufacturingApi, repackApi, productsApi, rawMaterialsApi, aiApi, packingConversionApi } from '../api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import { convertUnit } from '../utils/unitConverter';
import { Brain } from 'lucide-react';
import AIInsightsModal from '../components/AIInsightsModal';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n || 0);

const getMfgRecipeCost = (recipe) => {
  if (!recipe || !recipe.materials) return 0;
  return recipe.materials.reduce((sum, m) => sum + (Number(m.qty || 0) * Number(m.rawMaterial?.purchasePrice || 0)), 0);
};

const getRepackRecipeCost = (recipe) => {
  if (!recipe || !recipe.materials) return 0;
  return recipe.materials.reduce((sum, m) => sum + (Number(m.qty || 0) * Number(m.product?.purchasePrice || 0)), 0);
};

export default function ManufacturingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'recipes'; // 'recipes', 'production', 'history'

  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  
  // AI Assistant States
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState('');
  
  // Data States
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [mfgRecipes, setMfgRecipes] = useState([]);
  const [repackRecipes, setRepackRecipes] = useState([]);
  const [batchHistory, setBatchHistory] = useState([]);

  // Sub-navigation inside tab 1 (Recipes)
  const [recipeSubTab, setRecipeSubTab] = useState('mfg'); // 'mfg', 'repack'

  // Modals & Details
  const [recipeModal, setRecipeModal] = useState(null); // 'create_mfg', 'edit_mfg', 'create_repack', 'edit_repack'
  const [recipeForm, setRecipeForm] = useState(null);
  const [detailBatch, setDetailBatch] = useState(null); // Selected batch for detail modal
  const [editRepackBatch, setEditRepackBatch] = useState(null); // Selected repack run for edit modal

  // -------------------------------------------------------------
  // Load All System Data
  // -------------------------------------------------------------
  const loadSystemData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, rmRes, mfgRecRes, repRecRes, mfgRunsRes, repRunsRes, dashRes] = await Promise.all([
        productsApi.list({ limit: 1000 }),
        rawMaterialsApi.list({ limit: 1000 }),
        manufacturingApi.listRecipes(),
        repackApi.listRecipes(),
        manufacturingApi.list(),
        repackApi.list(),
        manufacturingApi.dashboard()
      ]);

      setProducts(prodRes.data.products || []);
      setRawMaterials(rmRes.data.materials || []);
      setMfgRecipes(mfgRecRes.data || []);
      setRepackRecipes(repRecRes.data || []);
      setDashboard(dashRes.data || null);

      // Merge and sort batch history logs
      const mfgEntries = (mfgRunsRes.data || []).map(e => ({
        ...e,
        batchType: 'manufacturing',
        batchNumber: e.mfgNumber,
        productName: e.product?.name || 'Unknown Product',
        productUnit: e.product?.unit || 'pcs',
        recipeName: e.recipe?.name || 'Manual Production Run'
      }));

      const repackEntries = (repRunsRes.data || []).map(e => ({
        ...e,
        batchType: 'repacking',
        batchNumber: e.repackNumber,
        productName: e.finishedProduct?.name || 'Unknown Product',
        productUnit: 'packs',
        recipeName: e.recipe?.recipeName || (e.packSize ? `Repack to ${e.packSize.packName}` : 'Direct Repack')
      }));

      const merged = [...mfgEntries, ...repackEntries].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
      setBatchHistory(merged);

    } catch (e) {
      console.error(e);
      toast('Failed to load manufacturing and production data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSystemData();
  }, [loadSystemData]);

  useEffect(() => {
    const variantId = searchParams.get('createRecipeForVariant');
    if (variantId && products.length > 0) {
      const variant = products.find(p => String(p.id || p._id) === String(variantId));
      if (variant) {
        // Find the parent product
        const parent = products.find(p => String(p.id || p._id) === String(variant.parentProductId));
        if (parent) {
          // Open recipe modal
          setRecipeForm({
            name: `${variant.name} Recipe`,
            productId: parent.id || parent._id,
            yieldQty: Number(variant.conversionFactor || 0.2) * 30,
            notes: `Formula for ${variant.name}`,
            variantProductId: variant.id || variant._id,
            packSize: variant.packSize || '',
            yieldPacks: 30,
            packWeight: Number(variant.conversionFactor || 0.2),
            wastagePercent: 0,
            materials: [{ rawMaterialId: '', qty: '' }]
          });
          setRecipeSubTab('mfg');
          setRecipeModal('create_mfg');
          // Clear query param so it doesn't open again
          searchParams.delete('createRecipeForVariant');
          setSearchParams(searchParams);
        }
      }
    }
  }, [searchParams, products, setSearchParams]);

  const setTab = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  const handleManufacturingAssistant = async () => {
    setAiModalOpen(true);
    setAiLoading(true);
    setAiInsights('');
    try {
      const res = await aiApi.manufacturingAssistant();
      setAiInsights(res.data.reply);
    } catch (err) {
      setAiInsights('Failed to generate manufacturing planners. Please verify your backend API connection and Gemini credentials.');
    } finally {
      setAiLoading(false);
    }
  };

  // Recipe delete helpers
  const handleDeleteRecipe = async (id, type) => {
    if (!confirm('Are you sure you want to delete this recipe formula?')) return;
    try {
      if (type === 'mfg') {
        await manufacturingApi.removeRecipe(id);
      } else {
        await repackApi.removeRecipe(id);
      }
      toast('Recipe formula deleted successfully', 'success');
      loadSystemData();
    } catch (err) {
      toast('Failed to delete recipe', 'error');
    }
  };

  // -------------------------------------------------------------
  // Render Smart Alert Banners
  // -------------------------------------------------------------
  const renderAlerts = () => {
    if (!dashboard?.alerts) return null;
    const { rawMaterialShortage, packagingMaterialShortage, productionDelays, pendingBackorders } = dashboard.alerts;
    const hasAlerts = rawMaterialShortage.length || packagingMaterialShortage.length || productionDelays.length || pendingBackorders.length;

    if (!hasAlerts) return null;

    return (
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderLeft: '5px solid #ff9800', background: '#fffcf5' }}>
        <h3 style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309', fontSize: '1.05rem', fontWeight: 800 }}>
          ⚠️ Production Alerts & Backorders
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
          {/* Raw Material Shortage */}
          {rawMaterialShortage.length > 0 && (
            <div>
              <strong style={{ color: '#c2410c' }}>🌾 Ingredient Shortages:</strong>
              <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, color: '#4b5563' }}>
                {rawMaterialShortage.slice(0, 3).map((a, i) => <li key={i}>{a}</li>)}
                {rawMaterialShortage.length > 3 && <li>and {rawMaterialShortage.length - 3} more ingredient(s)</li>}
              </ul>
            </div>
          )}
          {/* Packaging Shortage */}
          {packagingMaterialShortage.length > 0 && (
            <div>
              <strong style={{ color: '#b45309' }}>🏷️ Packaging Material Shortages:</strong>
              <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, color: '#4b5563' }}>
                {packagingMaterialShortage.slice(0, 3).map((a, i) => <li key={i}>{a}</li>)}
                {packagingMaterialShortage.length > 3 && <li>and {packagingMaterialShortage.length - 3} more material(s)</li>}
              </ul>
            </div>
          )}
          {/* Production Delays */}
          {productionDelays.length > 0 && (
            <div>
              <strong style={{ color: '#dc2626' }}>🕒 Delayed Pending Runs:</strong>
              <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, color: '#4b5563' }}>
                {productionDelays.slice(0, 3).map((a, i) => <li key={i}>{a}</li>)}
                {productionDelays.length > 3 && <li>and {productionDelays.length - 3} more pending order(s)</li>}
              </ul>
            </div>
          )}
          {/* Backorders Demand */}
          {pendingBackorders.length > 0 && (
            <div>
              <strong style={{ color: '#1e3a8a' }}>📦 Pending Backorder Demands:</strong>
              <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, color: '#4b5563' }}>
                {pendingBackorders.slice(0, 3).map((a, i) => <li key={i}>{a}</li>)}
                {pendingBackorders.length > 3 && <li>and {pendingBackorders.length - 3} more unfulfilled item(s)</li>}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            🏭 Manufacturing & Production
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
            Formulate Recipes, execute Production Wizards, repack Bulk Goods, and inspect Batch logs.
          </p>
        </div>
      </div>

      {/* Dashboard Statistics Cards */}
      {dashboard && (
        <div className="repack-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="repack-stat-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Today's Production</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ff9800', marginTop: '0.25rem' }}>{dashboard.metrics?.todaysProduction || 0} Runs</div>
          </div>
          <div className="repack-stat-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Today's Repacking</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#3b82f6', marginTop: '0.25rem' }}>{dashboard.metrics?.todaysRepacking || 0} Runs</div>
          </div>
          <div className="repack-stat-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Raw Materials Consumed</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444', marginTop: '0.25rem' }}>{dashboard.metrics?.rawMaterialsConsumed?.toFixed(2) || 0} Kg</div>
          </div>
          <div className="repack-stat-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Finished Goods Produced</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>{dashboard.metrics?.finishedGoodsProduced || 0} Packs</div>
          </div>
          <div className="repack-stat-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Pending Production</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.25rem' }}>{dashboard.metrics?.pendingProductionOrders || 0}</div>
          </div>
          <div className="repack-stat-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Low Stock Alerts</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444', marginTop: '0.25rem' }}>{dashboard.metrics?.lowStockRawMaterials || 0}</div>
          </div>
        </div>
      )}

      {/* Smart Alerts */}
      {renderAlerts()}

      {/* Primary Tab Navigation */}
      <div className="rm-tabs-bar" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem', gap: '0.5rem', overflowX: 'auto' }}>
        <button type="button" className={`rm-tab-btn ${currentTab === 'recipes' ? 'active' : ''}`} onClick={() => setTab('recipes')} style={{ padding: '0.75rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', borderBottom: currentTab === 'recipes' ? '3px solid #ff9800' : '3px solid transparent', color: currentTab === 'recipes' ? '#ff9800' : '#64748b' }}>
          📄 Recipe Master
        </button>
        <button type="button" className={`rm-tab-btn ${currentTab === 'production' ? 'active' : ''}`} onClick={() => setTab('production')} style={{ padding: '0.75rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', borderBottom: currentTab === 'production' ? '3px solid #ff9800' : '3px solid transparent', color: currentTab === 'production' ? '#ff9800' : '#64748b' }}>
          ⚡ Production Entry
        </button>
        <button type="button" className={`rm-tab-btn ${currentTab === 'repacking' ? 'active' : ''}`} onClick={() => setTab('repacking')} style={{ padding: '0.75rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', borderBottom: currentTab === 'repacking' ? '3px solid #ff9800' : '3px solid transparent', color: currentTab === 'repacking' ? '#ff9800' : '#64748b' }}>
          🔄 Repacking Entry
        </button>
        <button type="button" className={`rm-tab-btn ${currentTab === 'packing-conversion' ? 'active' : ''}`} onClick={() => setTab('packing-conversion')} style={{ padding: '0.75rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', borderBottom: currentTab === 'packing-conversion' ? '3px solid #ff9800' : '3px solid transparent', color: currentTab === 'packing-conversion' ? '#ff9800' : '#64748b' }}>
          📦 Packing Conversion
        </button>
        <button type="button" className={`rm-tab-btn ${currentTab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')} style={{ padding: '0.75rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', borderBottom: currentTab === 'history' ? '3px solid #ff9800' : '3px solid transparent', color: currentTab === 'history' ? '#ff9800' : '#64748b' }}>
          📜 Production History
        </button>
      </div>

      <div className="tab-content" style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
        {/* TAB 1: RECIPES */}
        {currentTab === 'recipes' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div className="pack-size-view-toggle">
                <button type="button" className={`pack-size-toggle-btn ${recipeSubTab === 'mfg' ? 'active' : ''}`} onClick={() => setRecipeSubTab('mfg')}>
                  🏭 Production Recipes
                </button>
                <button type="button" className={`pack-size-toggle-btn ${recipeSubTab === 'repack' ? 'active' : ''}`} onClick={() => setRecipeSubTab('repack')}>
                  🔄 Repacking Formulas
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', fontWeight: 600 }}
                onClick={() => openRecipeModal(null, recipeSubTab)}
              >
                + Add New Formula
              </button>
            </div>

            <div className="card table-wrap">
              {recipeSubTab === 'mfg' ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Formula Name</th>
                      <th>Yield Finished Product</th>
                      <th>Base Yield Qty</th>
                      <th>Raw Ingredients Consumed</th>
                      <th>Estimated Formula Cost</th>
                      <th>Internal Notes</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mfgRecipes.map(rec => (
                      <tr key={rec.id || rec._id}>
                        <td style={{ fontWeight: 700 }}>{rec.name}</td>
                        <td>{rec.product?.name} ({rec.product?.sku})</td>
                        <td>{rec.yieldQty} {rec.product?.unit}</td>
                        <td>
                          <div style={{ fontSize: '0.8rem' }}>
                            {rec.materials?.map((m, i) => (
                              <div key={i}>• {m.rawMaterial?.name}: <strong>{m.qty}</strong> {m.rawMaterial?.unit} (₹{Number(m.rawMaterial?.purchasePrice || 0).toFixed(1)}/u)</div>
                            ))}
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, color: '#ff9800' }}>{fmt(getMfgRecipeCost(rec))}</td>
                        <td>{rec.notes || '—'}</td>
                        <td><span className={`badge ${rec.status === 'Active' ? 'badge-success' : 'badge-secondary'}`}>{rec.status}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openRecipeModal(rec, 'mfg')}>Edit</button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteRecipe(rec.id || rec._id, 'mfg')}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {mfgRecipes.length === 0 && (
                      <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No production recipes defined yet.</td></tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Formula Name</th>
                      <th>Finished Pack Size Output</th>
                      <th>Yield Packs</th>
                      <th>Bulk Consumed</th>
                      <th>Estimated Cost</th>
                      <th>Wastage Allowance</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repackRecipes.map(rec => (
                      <tr key={rec.id || rec._id}>
                        <td style={{ fontWeight: 700 }}>{rec.recipeName}</td>
                        <td>{rec.finishedProduct?.name} ({rec.finishedProduct?.sku})</td>
                        <td>{rec.finishedQty} {rec.unit || 'packs'}</td>
                        <td>
                          <div style={{ fontSize: '0.8rem' }}>
                            {rec.materials?.map((m, i) => (
                              <div key={i}>• Consumes: <strong>{m.qty} Kg</strong> of bulk (₹{Number(m.product?.purchasePrice || 0).toFixed(1)}/Kg)</div>
                            ))}
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, color: '#ff9800' }}>{fmt(getRepackRecipeCost(rec))}</td>
                        <td>{rec.wastagePercent}%</td>
                        <td><span className={`badge ${rec.status === 'active' ? 'badge-success' : 'badge-secondary'}`}>{rec.status}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openRecipeModal(rec, 'repack')}>Edit</button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteRecipe(rec.id || rec._id, 'repack')}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {repackRecipes.length === 0 && (
                      <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No repacking recipes defined yet.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCTION ENTRY */}
        {currentTab === 'production' && (
          <ProductionEntry 
            products={products}
            rawMaterials={rawMaterials}
            mfgRecipes={mfgRecipes}
            loadSystemData={loadSystemData}
            setTab={setTab}
          />
        )}

        {/* TAB 3: REPACKING ENTRY */}
        {currentTab === 'repacking' && (
          <RepackingEntry 
            products={products}
            rawMaterials={rawMaterials}
            loadSystemData={loadSystemData}
            setTab={setTab}
          />
        )}

        {/* TAB: PACKING CONVERSION */}
        {currentTab === 'packing-conversion' && (
          <PackingConversionTab 
            products={products}
            loadSystemData={loadSystemData}
          />
        )}

        {/* TAB 3: BATCH HISTORY LOGS */}
        {currentTab === 'history' && (
          <div className="card table-wrap">
            <table className="data-table mfg-table">
              <thead>
                <tr>
                  <th>Batch / Run #</th>
                  <th>Type</th>
                  <th>Date Logged</th>
                  <th>Product Yield Produced</th>
                  <th>Formula Formula</th>
                  <th>Total Cost</th>
                  <th>Cost/Unit</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batchHistory.map((h, idx) => (
                  <tr key={idx}>
                    <td><strong>{h.batchNumber}</strong></td>
                    <td>
                      <span className={`badge ${h.batchType === 'manufacturing' ? 'badge-success' : 'badge-primary'}`}>
                        {h.batchType === 'manufacturing' ? '🏭 Production' : '🔄 Repacking'}
                      </span>
                    </td>
                    <td>{new Date(h.date || h.createdAt).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 600 }}>{h.qtyToProduce} {h.productUnit} of {h.productName}</td>
                    <td>{h.recipeName}</td>
                    <td>{fmt(h.totalCost)}</td>
                    <td>{fmt(h.costPerUnit)}</td>
                    <td>
                      <span className={`badge ${h.status === 'completed' ? 'badge-success' : h.status === 'reversed' ? 'badge-danger' : 'badge-warning'}`}>
                        {h.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetailBatch(h)}>Details</button>
                        {h.batchType === 'repacking' && h.status !== 'reversed' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#fff' }}
                            onClick={() => setEditRepackBatch(h)}
                          >
                            Edit
                          </button>
                        )}
                        {h.status === 'completed' && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleReverseBatch(h.id || h._id, h.batchType)}
                          >
                            Reverse
                          </button>
                        )}
                        {h.status === 'pending' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                            onClick={() => handleCompletePendingBatch(h.id || h._id, h.batchType)}
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {batchHistory.length === 0 && (
                  <tr><td colSpan="9" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No batch logs recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Batch Details Modal */}
      {detailBatch && (
        <BatchDetailsModal 
          batch={detailBatch} 
          onClose={() => setDetailBatch(null)} 
        />
      )}

      {/* Edit Repack Modal */}
      {editRepackBatch && (
        <EditRepackModal
          batch={editRepackBatch}
          onClose={() => setEditRepackBatch(null)}
          onRefresh={loadSystemData}
          products={products}
          rawMaterials={rawMaterials}
        />
      )}

      {/* Recipes Edit/Create Modals */}
      {recipeModal && (
        <RecipeFormModal
          type={recipeModal}
          form={recipeForm}
          setForm={setRecipeForm}
          products={products}
          rawMaterials={rawMaterials}
          onClose={() => setRecipeModal(null)}
          onSave={saveRecipe}
        />
      )}
    </div>
  );

  // -------------------------------------------------------------
  // Complete Pending Batch Run Action
  // -------------------------------------------------------------
  async function handleCompletePendingBatch(id, type) {
    if (!confirm('Mark this pending batch order as Completed? This will deduct raw materials and add finished goods to stock.')) return;
    try {
      if (type === 'manufacturing') {
        await manufacturingApi.update(id, { status: 'completed' });
      } else {
        await repackApi.update(id, { status: 'completed' });
      }
      toast('Batch run successfully completed! Stocks updated.', 'success');
      loadSystemData();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to complete production run', 'error');
    }
  }

  // Helper for batch reversals
  async function handleReverseBatch(id, type) {
    if (!confirm('Are you sure you want to REVERSE this batch run? This will return all consumed raw items to stock and deduct produced goods. This action cannot be undone.')) return;
    try {
      if (type === 'manufacturing') {
        await manufacturingApi.reverse(id);
      } else {
        await repackApi.remove(id);
      }
      toast('Batch run reversed successfully', 'success');
      loadSystemData();
    } catch (err) {
      toast(err.response?.data?.message || 'Reversal failed', 'error');
    }
  }

  // Recipe Modal Helpers
  function openRecipeModal(rec = null, subTab) {
    if (subTab === 'mfg') {
      setRecipeForm(rec ? {
        id: rec.id || rec._id,
        name: rec.name,
        productId: rec.productId,
        yieldQty: rec.yieldQty,
        notes: rec.notes,
        variantProductId: rec.variantProductId || '',
        packSize: rec.packSize || 'Bulk',
        yieldPacks: rec.yieldPacks || '',
        packWeight: rec.packWeight || '',
        wastagePercent: rec.wastagePercent || 0,
        materials: rec.materials?.map(m => ({ rawMaterialId: m.rawMaterialId, qty: m.qty })) || [{ rawMaterialId: '', qty: '' }]
      } : {
        name: '',
        productId: '',
        yieldQty: 1.0,
        notes: '',
        variantProductId: '',
        packSize: 'Bulk',
        yieldPacks: '',
        packWeight: '',
        wastagePercent: 0,
        materials: [{ rawMaterialId: '', qty: '' }]
      });
      setRecipeModal(rec ? 'edit_mfg' : 'create_mfg');
    } else {
      setRecipeForm(rec ? {
        id: rec.id || rec._id,
        recipeName: rec.recipeName,
        finishedProductId: rec.finishedProductId,
        finishedQty: rec.finishedQty,
        unit: rec.unit || 'packs',
        wastagePercent: rec.wastagePercent || 0,
        notes: rec.notes,
        status: rec.status,
        materials: rec.materials?.map(m => ({ productId: m.productId, qty: m.qty })) || [{ productId: '', qty: '' }]
      } : {
        recipeName: '',
        finishedProductId: '',
        finishedQty: 1,
        unit: 'packs',
        wastagePercent: 0,
        notes: '',
        status: 'active',
        materials: [{ productId: '', qty: 1 }]
      });
      setRecipeModal(rec ? 'edit_repack' : 'create_repack');
    }
  }

  async function saveRecipe() {
    try {
      const isMfg = recipeModal.endsWith('_mfg');
      
      // Filter out any materials/ingredients with blank IDs
      const sanitizedMaterials = (recipeForm.materials || []).filter(mat => {
        if (isMfg) {
          return mat.rawMaterialId && mat.rawMaterialId !== '';
        } else {
          return mat.productId && mat.productId !== '';
        }
      });

      if (sanitizedMaterials.length === 0) {
        toast('At least one valid ingredient/material is required.', 'warning');
        return;
      }

      const hasInvalidQty = sanitizedMaterials.some(mat => !mat.qty || Number(mat.qty) <= 0);
      if (hasInvalidQty) {
        toast('Quantity for all ingredients must be greater than 0.', 'warning');
        return;
      }

      const sanitizedForm = {
        ...recipeForm,
        materials: sanitizedMaterials
      };

      if (isMfg) {
        if (recipeModal === 'edit_mfg') {
          await manufacturingApi.updateRecipe(recipeForm.id, sanitizedForm);
          toast('Manufacturing recipe formula updated', 'success');
        } else {
          await manufacturingApi.createRecipe(sanitizedForm);
          toast('Manufacturing recipe formula created', 'success');
        }
      } else {
        if (recipeModal === 'edit_repack') {
          await repackApi.updateRecipe(recipeForm.id, sanitizedForm);
          toast('Repack recipe formula updated', 'success');
        } else {
          await repackApi.createRecipe(sanitizedForm);
          toast('Repack recipe formula created', 'success');
        }
      }
      setRecipeModal(null);
      loadSystemData();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save recipe formula', 'error');
    }
  }
}

// -------------------------------------------------------------
// sub-component: PRODUCTION WIZARD
// -------------------------------------------------------------
function ProductionEntry({ products, rawMaterials, mfgRecipes, loadSystemData, setTab }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [recipeId, setRecipeId] = useState('');
  const [workflowMode, setWorkflowMode] = useState('pack');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [laborCost, setLaborCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [notes, setNotes] = useState('');
  const [mfgEntryId, setMfgEntryId] = useState(null);
  const [mfgNumber, setMfgNumber] = useState('');

  const resetEntry = () => {
    setStep(1);
    setRecipeId('');
    setWorkflowMode('pack');
    setProductId('');
    setQty('');
    setLaborCost(0);
    setOtherCost(0);
    setNotes('');
    setMfgEntryId(null);
    setMfgNumber('');
  };

  const selectedRecipe = mfgRecipes.find(r => String(r.id) === String(recipeId));
  const selectedProduct = products.find(p => String(p.id || p._id) === String(productId));

  const handleRecipeChange = (rId) => {
    setRecipeId(rId);
    const rec = mfgRecipes.find(r => String(r.id) === String(rId));
    if (rec) {
      if (rec.variantProductId) {
        setWorkflowMode('pack');
        setProductId(rec.variantProductId);
        setQty(rec.yieldPacks || '');
      } else {
        setWorkflowMode('bulk');
        setProductId(rec.productId);
        setQty(rec.yieldQty || '');
      }
    } else {
      setProductId('');
      setQty('');
    }
  };

  const handleWorkflowModeChange = (mode) => {
    setWorkflowMode(mode);
    const rec = mfgRecipes.find(r => String(r.id) === String(recipeId));
    if (rec) {
      if (mode === 'pack') {
        setProductId(rec.variantProductId);
        setQty(rec.yieldPacks || '');
      } else {
        setProductId(rec.productId);
        setQty(rec.yieldQty || '');
      }
    }
  };

  // Auto-calculations
  const calculateRequirements = () => {
    if (!qty || qty <= 0 || !selectedRecipe) return null;
    const targetQty = Number(qty);
    const wastageMultiplier = 1 + (Number(selectedRecipe.wastagePercent || 0) / 100);

    let totalOutputWeight = targetQty;
    let ingredientMultiplier = 1;
    let weightMultiplier = 1;

    if (workflowMode === 'pack') {
      const pWeight = Number(selectedRecipe.packWeight || 0.200);
      totalOutputWeight = targetQty * pWeight;
      ingredientMultiplier = (totalOutputWeight / Number(selectedRecipe.yieldQty || 1)) * wastageMultiplier;
    } else {
      totalOutputWeight = targetQty;
      weightMultiplier = (targetQty / Number(selectedRecipe.yieldQty || 1)) * wastageMultiplier;
    }

    // 1. Raw Materials from recipe
    const rawMaterialsList = (selectedRecipe.materials || []).map(m => {
      const isPackaging = ['Packaging Materials', 'Labels', 'Pouches', 'Cartons', 'Bottles'].includes(m.rawMaterial?.category);
      let needed;
      if (workflowMode === 'pack') {
        needed = isPackaging ? targetQty : (Number(m.qty) * ingredientMultiplier);
      } else {
        needed = isPackaging ? 0 : (Number(m.qty) * weightMultiplier);
      }
      const available = Number(m.rawMaterial?.stock || 0);
      const unitCost = Number(m.rawMaterial?.purchasePrice || 0);
      return {
        id: m.rawMaterialId,
        name: m.rawMaterial?.name || 'Unknown',
        category: m.rawMaterial?.category || 'General',
        needed,
        available,
        unit: m.rawMaterial?.unit || 'Kg',
        unitCost,
        totalCost: needed * unitCost,
        isShortage: needed > available,
        isPackaging
      };
    }).filter(m => m.needed > 0);

    // 2. Packaging Materials automatically parsed
    const packagingList = [];
    if (workflowMode === 'pack') {
      const match = selectedProduct?.name?.match(/(\d+\s*(?:g|kg|ml|litre|pcs|box|carton|l))/i);
      const packName = match ? match[1].replace(/\s+/g, '').toLowerCase() : null;
      if (packName) {
        // Find matching pouch
        const pouch = rawMaterials.find(rm => 
          ['Pouches', 'Packaging Materials'].includes(rm.category) && 
          rm.name.toLowerCase().includes(packName)
        );
        // Find matching label
        const label = rawMaterials.find(rm => 
          ['Labels'].includes(rm.category) && 
          rm.name.toLowerCase().includes(packName)
        );

        if (pouch && !rawMaterialsList.some(m => m.id === pouch.id)) {
          const needed = targetQty;
          const available = Number(pouch.stock || 0);
          const unitCost = Number(pouch.purchasePrice || 0);
          packagingList.push({
            id: pouch.id,
            name: pouch.name,
            category: pouch.category,
            needed,
            available,
            unit: pouch.unit || 'pcs',
            unitCost,
            totalCost: needed * unitCost,
            isShortage: needed > available
          });
        }

        if (label && !rawMaterialsList.some(m => m.id === label.id)) {
          const needed = targetQty;
          const available = Number(label.stock || 0);
          const unitCost = Number(label.purchasePrice || 0);
          packagingList.push({
            id: label.id,
            name: label.name,
            category: label.category,
            needed,
            available,
            unit: label.unit || 'pcs',
            unitCost,
            totalCost: needed * unitCost,
            isShortage: needed > available
          });
        }
      }
    }

    const recipeRawCost = rawMaterialsList.reduce((sum, m) => sum + m.totalCost, 0);
    const packagingCost = packagingList.reduce((sum, m) => sum + m.totalCost, 0);
    const totalCost = recipeRawCost + packagingCost + Number(laborCost || 0) + Number(otherCost || 0);
    const costPerUnit = targetQty > 0 ? (totalCost / targetQty) : 0;

    const hasRawShortage = rawMaterialsList.some(m => m.isShortage);
    const hasPkgShortage = packagingList.some(m => m.isShortage);

    return {
      rawMaterialsList,
      packagingList,
      recipeRawCost,
      packagingCost,
      totalCost,
      costPerUnit,
      hasRawShortage,
      hasPkgShortage,
      totalOutputWeight
    };
  };

  const calc = calculateRequirements();

  const handleStartProduction = async () => {
    if (calc?.hasRawShortage || calc?.hasPkgShortage) {
      toast('Cannot start production due to material shortages!', 'error');
      return;
    }
    try {
      const payload = {
        recipeId: selectedRecipe.id,
        productId,
        qtyToProduce: Number(qty),
        laborCost,
        otherCost,
        notes: notes || 'Started production run.',
        status: 'pending',
        productionMode: workflowMode === 'pack' ? 'pack' : 'weight'
      };
      const res = await manufacturingApi.create(payload);
      setMfgEntryId(res.data.id || res.data.entry?.id);
      setMfgNumber(res.data.mfgNumber || res.data.entry?.mfgNumber || 'MFG-BATCH');
      setStep(4);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to start production run', 'error');
    }
  };

  const handleCompleteProduction = async () => {
    try {
      await manufacturingApi.update(mfgEntryId, { status: 'completed' });
      toast('Production run successfully completed!', 'success');
      loadSystemData();
      setStep(5);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to complete production run', 'error');
    }
  };

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
      {/* Step Progress Indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🏭 Production Entry
        </h2>
        <span style={{ fontSize: '0.85rem', background: '#fff8f0', color: '#ff9800', padding: '0.35rem 0.75rem', borderRadius: '8px', fontWeight: 700 }}>
          Step {step} of 5
        </span>
      </div>

      {/* STEP 1: Select Recipe */}
      {step === 1 && (
        <div>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontWeight: 700, fontSize: '1rem', color: '#334155', display: 'block', marginBottom: '0.5rem' }}>Select Recipe to Manufacture</label>
            <select
              className="form-control"
              style={{ height: '52px', fontSize: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}
              value={recipeId}
              onChange={(e) => handleRecipeChange(e.target.value)}
            >
              <option value="">-- Choose Recipe --</option>
              {mfgRecipes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.product?.name || 'Bulk'}{r.variantProduct ? ` - ${r.variantProduct.packSize || r.variantProduct.name}` : ' - Bulk'})
                </option>
              ))}
            </select>
            <small style={{ color: '#64748b', marginTop: '0.5rem', display: 'block' }}>Only active recipes from Recipe Master are shown.</small>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', height: '48px', padding: '0 2rem', fontWeight: 600, borderRadius: '10px' }} disabled={!recipeId} onClick={() => setStep(2)}>
              Next Step &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Enter Quantity & Select Mode */}
      {step === 2 && (
        <div>
          <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Selected Recipe:</span>
            <strong style={{ color: '#0f172a', display: 'block', fontSize: '1.15rem', marginTop: '0.25rem' }}>{selectedRecipe?.name}</strong>
            <span style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
              Base Yield: {selectedRecipe?.variantProduct ? `${selectedRecipe?.yieldPacks} Packs` : `${selectedRecipe?.yieldQty} KG`}
              {selectedRecipe?.variantProduct && ` (${selectedRecipe?.yieldQty} KG)`}
            </span>
          </div>

          {selectedRecipe?.variantProductId && (
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 700, fontSize: '1rem', color: '#334155', display: 'block', marginBottom: '0.5rem' }}>Workflow Mode</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: workflowMode === 'pack' ? '#f0f6ff' : '#fff', border: workflowMode === 'pack' ? '2px solid #2563eb' : '1px solid #cbd5e1', padding: '0.75rem 1.25rem', borderRadius: '10px', transition: 'all 0.2s', margin: 0 }}>
                  <input type="radio" name="workflowMode" value="pack" checked={workflowMode === 'pack'} onChange={() => handleWorkflowModeChange('pack')} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.9rem', color: '#1e293b' }}>Direct to Pack</strong>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Increases variant stock in PCS</span>
                  </div>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: workflowMode === 'bulk' ? '#f0f6ff' : '#fff', border: workflowMode === 'bulk' ? '2px solid #2563eb' : '1px solid #cbd5e1', padding: '0.75rem 1.25rem', borderRadius: '10px', transition: 'all 0.2s', margin: 0 }}>
                  <input type="radio" name="workflowMode" value="bulk" checked={workflowMode === 'bulk'} onChange={() => handleWorkflowModeChange('bulk')} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.9rem', color: '#1e293b' }}>Manufacture Bulk</strong>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Increases bulk stock in KG</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontWeight: 700, fontSize: '1rem', color: '#334155', display: 'block', marginBottom: '0.5rem' }}>
              Enter Production Quantity ({workflowMode === 'pack' ? 'Packs' : 'KG'})
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="form-control"
              style={{ height: '52px', fontSize: '1.1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}
              placeholder={workflowMode === 'pack' ? `e.g. ${selectedRecipe?.yieldPacks || 30}` : `e.g. ${selectedRecipe?.yieldQty || 6.0}`}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <button type="button" className="btn btn-secondary" style={{ height: '48px', padding: '0 1.5rem', borderRadius: '10px' }} onClick={() => setStep(1)}>
              &larr; Back
            </button>
            <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', height: '48px', padding: '0 2rem', fontWeight: 600, borderRadius: '10px' }} disabled={!qty || Number(qty) <= 0} onClick={() => setStep(3)}>
              Next Step &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Auto calculations and shortage checks */}
      {step === 3 && calc && (
        <div>
          {/* Shortage Badges */}
          {calc.hasRawShortage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#b91c1c', fontWeight: 700, fontSize: '0.9rem' }}>
              ⚠ Raw Material Shortage
            </div>
          )}
          {calc.hasPkgShortage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#d97706', fontWeight: 700, fontSize: '0.9rem' }}>
              ⚠ Packaging Material Shortage
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>Expected Output</h3>
            <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontWeight: 700 }}>
              {qty} {workflowMode === 'pack' ? 'Packs' : 'KG'} of {selectedProduct?.name} 
              {workflowMode === 'pack' && ` (Total Weight: ${calc.totalOutputWeight.toFixed(2)} KG)`}
            </div>
          </div>

          {/* Raw Materials Table */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Raw Materials Required</h3>
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <table className="data-table" style={{ margin: 0, fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '0.75rem' }}>Material</th>
                    <th style={{ padding: '0.75rem' }}>Required</th>
                    <th style={{ padding: '0.75rem' }}>Stock</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.rawMaterialsList.map((m, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{m.name}</td>
                      <td style={{ padding: '0.75rem' }}>{m.needed.toFixed(2)} {m.unit}</td>
                      <td style={{ padding: '0.75rem' }}>{m.available.toFixed(2)} {m.unit}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, background: m.isShortage ? '#fef2f2' : '#f0fdf4', color: m.isShortage ? '#dc2626' : '#16a34a' }}>
                          {m.isShortage ? 'Shortage' : 'Available'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Packaging Table */}
          {calc.packagingList.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Packaging Required</h3>
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                <table className="data-table" style={{ margin: 0, fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '0.75rem' }}>Packaging Item</th>
                      <th style={{ padding: '0.75rem' }}>Required</th>
                      <th style={{ padding: '0.75rem' }}>Stock</th>
                      <th style={{ padding: '0.75rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.packagingList.map((m, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{m.name}</td>
                        <td style={{ padding: '0.75rem' }}>{m.needed} {m.unit}</td>
                        <td style={{ padding: '0.75rem' }}>{m.available.toFixed(0)} {m.unit}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, background: m.isShortage ? '#fef2f2' : '#f0fdf4', color: m.isShortage ? '#dc2626' : '#16a34a' }}>
                            {m.isShortage ? 'Shortage' : 'Available'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cost overheads */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Labor Costs (₹)</label>
              <input type="number" min="0" step="1" className="form-control" style={{ borderRadius: '8px' }} value={laborCost} onChange={(e) => setLaborCost(Number(e.target.value))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Overhead Costs (₹)</label>
              <input type="number" min="0" step="1" className="form-control" style={{ borderRadius: '8px' }} value={otherCost} onChange={(e) => setOtherCost(Number(e.target.value))} />
            </div>
          </div>

          {/* Cost Summary Box */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Production Cost</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ff9800' }}>{fmt(calc.totalCost)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                {workflowMode === 'pack' ? 'Cost Per Pack' : 'Cost Per KG'}
              </span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{fmt(calc.costPerUnit)}</div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Production Notes</label>
            <textarea className="form-control" style={{ borderRadius: '8px' }} rows={2} placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <button type="button" className="btn btn-secondary" style={{ height: '48px', padding: '0 1.5rem', borderRadius: '10px' }} onClick={() => setStep(2)}>
              &larr; Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', height: '48px', padding: '0 2.5rem', fontWeight: 700, borderRadius: '10px' }}
              disabled={calc.hasRawShortage || calc.hasPkgShortage}
              onClick={handleStartProduction}
            >
              START PRODUCTION
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Start Production Success / Pending Complete */}
      {step === 4 && (
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <span style={{ fontSize: '4rem', display: 'block', animation: 'spin 3s linear infinite', marginBottom: '1.5rem' }}>⚙️</span>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>Production Batch {mfgNumber} Started!</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto 2rem' }}>
            The batch is currently in **Pending** status. Click Complete below to deduct stock and finalize production.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button type="button" className="btn btn-secondary" style={{ height: '48px', borderRadius: '10px' }} onClick={() => setTab('history')}>
              View Logs
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ backgroundColor: '#10b981', borderColor: '#10b981', height: '48px', padding: '0 2rem', fontWeight: 700, borderRadius: '10px' }}
              onClick={handleCompleteProduction}
            >
              COMPLETE PRODUCTION
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Completed Success */}
      {step === 5 && (
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <span style={{ fontSize: '4.5rem', color: '#10b981', display: 'block', marginBottom: '1rem' }}>🎉</span>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', margin: '0 0 0.5rem 0' }}>Production Completed!</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
            Ingredients and packaging stock have been reduced. Finished goods stock has been increased.
          </p>
          <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', height: '48px', padding: '0 2rem', fontWeight: 600, borderRadius: '10px' }} onClick={resetEntry}>
            Start New Run
          </button>
        </div>
      )}
    </div>
  );
}

function RepackingEntry({ products, rawMaterials, loadSystemData, setTab }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [productId, setProductId] = useState('');
  const [packSizeId, setPackSizeId] = useState('');
  const [qty, setQty] = useState('');
  const [laborCost, setLaborCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [notes, setNotes] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [lossQty, setLossQty] = useState(0);

  const resetEntry = () => {
    setStep(1);
    setProductId('');
    setPackSizeId('');
    setQty('');
    setLaborCost(0);
    setOtherCost(0);
    setLossQty(0);
    setNotes('');
  };

  const repackingProducts = products.filter(p => p.packSizes && p.packSizes.length > 0);

  if (repackingProducts.length === 0) {
    return (
      <div style={{ maxWidth: '750px', margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🔄 Repacking Entry
        </h2>
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '1.5rem', borderRadius: '12px', margin: '1.5rem 0', fontSize: '0.95rem', fontWeight: 600, lineHeight: 1.5, textAlign: 'center' }}>
          ⚠️ No bulk repacking products available.<br />
          Please create a Product with Pack Sizes in Product Master.
        </div>
        
        {/* Render debug panel even in empty state so admin can troubleshoot */}
        <div style={{ marginTop: '2.5rem', borderTop: '1px dashed #cbd5e1', paddingTop: '1.5rem' }}>
          <button
            type="button"
            onClick={() => setShowDebug(!showDebug)}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              margin: '0 auto'
            }}
          >
            🔧 {showDebug ? 'Hide' : 'Show'} Admin Debugging Panel
          </button>
          
          {showDebug && (
            <div style={{ marginTop: '1rem', background: '#0f172a', color: '#e2e8f0', padding: '1.25rem', borderRadius: '12px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 'bold', color: '#ff9800', marginBottom: '0.75rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
                Product Visibility Debugger (All Products)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                    <th style={{ padding: '0.5rem 0' }}>Product Name</th>
                    <th>Product Type</th>
                    <th>Current Stock</th>
                    <th>Supplier</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const isVisible = p.packSizes && p.packSizes.length > 0;
                    return (
                      <tr key={p.id || p._id} style={{ borderBottom: '1px solid #1e293b', color: isVisible ? '#4ade80' : '#94a3b8' }}>
                        <td style={{ padding: '0.5rem 0' }}>{p.name}</td>
                        <td>{p.productType || 'NULL'}</td>
                        <td>{p.stock} {p.unit}</td>
                        <td>{p.supplier || '—'}</td>
                        <td>
                          <span style={{
                            backgroundColor: isVisible ? '#064e3b' : '#312e81',
                            color: isVisible ? '#6ee7b7' : '#c7d2fe',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem'
                          }}>
                            {isVisible ? 'VISIBLE' : 'HIDDEN'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                * To make a product visible in Repacking Entry, it must have custom pack sizes configured in the Product Master.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const selectedProduct = products.find(p => String(p.id || p._id) === String(productId));
  const availablePackSizes = selectedProduct ? (selectedProduct.packSizes || []) : [];
  const selectedPackSize = availablePackSizes.find(ps => String(ps.id || ps._id) === String(packSizeId));

  // Calculations
  const calculateRepack = () => {
    if (!qty || qty <= 0 || !selectedPackSize) return null;
    const packQty = Number(qty);
    const weightToConsumeKg = (packQty * Number(selectedPackSize.weightInGrams)) / 1000;
    const totalBulkNeededKg = weightToConsumeKg + Number(lossQty || 0);
    const bulkQtyNeeded = selectedProduct ? convertUnit(totalBulkNeededKg, 'kg', selectedProduct.unit) : 0;

    // Pouch and label matching by name
    const packName = selectedPackSize.packName;
    const pouch = rawMaterials.find(rm => 
      ['Pouches', 'Packaging Materials'].includes(rm.category) && 
      rm.name.toLowerCase().includes(packName.toLowerCase())
    );
    const label = rawMaterials.find(rm => 
      ['Labels'].includes(rm.category) && 
      rm.name.toLowerCase().includes(packName.toLowerCase())
    );

    const isBulkLow = selectedProduct ? (Number(selectedProduct.stock) < bulkQtyNeeded) : false;
    const isPouchLow = pouch ? (Number(pouch.stock) < packQty) : false;
    const isLabelLow = label ? (Number(label.stock) < packQty) : false;

    const bulkCost = selectedProduct ? (bulkQtyNeeded * Number(selectedProduct.purchasePrice || 0)) : 0;
    const pouchCost = pouch ? (Number(pouch.purchasePrice || 0) * packQty) : 0;
    const labelCost = label ? (Number(label.purchasePrice || 0) * packQty) : 0;
    const packingCostTotal = pouchCost + labelCost;
    const totalCost = bulkCost + packingCostTotal + Number(laborCost || 0) + Number(otherCost || 0);
    const costPerUnit = packQty > 0 ? (totalCost / packQty) : 0;

    return {
      bulkQtyNeeded,
      weightToConsumeKg,
      pouch,
      label,
      isBulkLow,
      isPouchLow,
      isLabelLow,
      bulkCost,
      pouchCost,
      labelCost,
      packingCostTotal,
      totalCost,
      costPerUnit
    };
  };

  const calc = calculateRepack();

  const handleCompleteRepacking = async (e) => {
    if (e) e.preventDefault();
    if (calc?.isBulkLow || calc?.isPouchLow || calc?.isLabelLow) {
      toast('Cannot execute repack due to stock shortages!', 'error');
      return;
    }
    try {
      const payload = {
        productId,
        packSizeId,
        qtyToProduce: qty,
        laborCost,
        packingMaterialCost: calc.packingCostTotal,
        otherCost,
        lossQty,
        notes: notes || 'Repack entry completed.',
        status: 'completed',
        date: new Date().toISOString().substring(0, 10)
      };
      await repackApi.create(payload);
      toast('Repacking successfully completed!', 'success');
      loadSystemData();
      setStep(5);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to complete repacking', 'error');
    }
  };

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🔄 Repacking Entry
        </h2>
        <span style={{ fontSize: '0.85rem', background: '#e0f2fe', color: '#0284c7', padding: '0.35rem 0.75rem', borderRadius: '8px', fontWeight: 700 }}>
          Step {step} of 5
        </span>
      </div>

      {/* STEP 1: Select Bulk Product */}
      {step === 1 && (
        <div>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontWeight: 700, fontSize: '1rem', color: '#334155', display: 'block', marginBottom: '0.5rem' }}>Select Bulk Source Product</label>
            <select
              className="form-control"
              style={{ height: '52px', fontSize: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}
              value={productId}
              onChange={(e) => { setProductId(e.target.value); setPackSizeId(''); }}
            >
              <option value="">-- Choose Bulk Product --</option>
              {repackingProducts.map(p => (
                <option key={p.id || p._id} value={p.id || p._id}>
                  {p.name} (Stock: {Number(p.stock).toFixed(2)} {p.unit} | Supplier: {p.supplier || 'N/A'})
                </option>
              ))}
            </select>
            <small style={{ color: '#64748b', marginTop: '0.5rem', display: 'block' }}>Only products configured with custom pack sizes are listed.</small>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', height: '48px', padding: '0 2rem', fontWeight: 600, borderRadius: '10px' }} disabled={!productId} onClick={() => setStep(2)}>
              Next Step &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Select Pack Size */}
      {step === 2 && (
        <div>
          <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Source Bulk:</span>
            <strong style={{ color: '#0f172a', display: 'block', fontSize: '1.15rem', marginTop: '0.25rem' }}>{selectedProduct?.name}</strong>
          </div>

          <label style={{ fontWeight: 700, fontSize: '1rem', color: '#334155', display: 'block', marginBottom: '1rem' }}>Select Target Pack Size</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {availablePackSizes.map(ps => {
              const isSelected = String(ps.id || ps._id) === String(packSizeId);
              return (
                <div
                  key={ps.id || ps._id}
                  onClick={() => setPackSizeId(ps.id || ps._id)}
                  style={{
                    border: isSelected ? '2px solid #ff9800' : '1px solid #cbd5e1',
                    borderRadius: '12px',
                    padding: '1.5rem 1rem',
                    cursor: 'pointer',
                    background: isSelected ? '#fffcf7' : '#fff',
                    transition: 'all 0.15s ease-in-out',
                    boxShadow: isSelected ? '0 4px 12px rgba(255,152,0,0.1)' : 'none',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: isSelected ? '#ff9800' : '#0f172a' }}>
                    📦 {ps.packName}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Weight/Vol: {ps.weightInGrams} {ps.unit || 'g'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.1rem' }}>
                    Current stock: {ps.stock} packs
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981', marginTop: '0.5rem' }}>
                    ₹{ps.sellingPrice}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <button type="button" className="btn btn-secondary" style={{ height: '48px', padding: '0 1.5rem', borderRadius: '10px' }} onClick={() => setStep(1)}>
              &larr; Back
            </button>
            <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', height: '48px', padding: '0 2rem', fontWeight: 600, borderRadius: '10px' }} disabled={!packSizeId} onClick={() => setStep(3)}>
              Next Step &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Enter Number of Packs */}
      {step === 3 && (
        <div>
          <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Repacking:</span>
            <strong style={{ color: '#0f172a', display: 'block', fontSize: '1.15rem', marginTop: '0.25rem' }}>
              {selectedProduct?.name} &rarr; {selectedPackSize?.packName}
            </strong>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontWeight: 700, fontSize: '1rem', color: '#334155', display: 'block', marginBottom: '0.5rem' }}>Number of Packs to Produce</label>
            <input
              type="number"
              min="1"
              step="1"
              className="form-control"
              style={{ height: '52px', fontSize: '1.1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}
              placeholder="e.g. 100"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontWeight: 700, fontSize: '1rem', color: '#334155', display: 'block', marginBottom: '0.5rem' }}>Loss / Wastage Quantity (Kg)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              style={{ height: '52px', fontSize: '1.1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}
              placeholder="e.g. 0.5"
              value={lossQty}
              onChange={(e) => setLossQty(Number(e.target.value))}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <button type="button" className="btn btn-secondary" style={{ height: '48px', padding: '0 1.5rem', borderRadius: '10px' }} onClick={() => setStep(2)}>
              &larr; Back
            </button>
            <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', height: '48px', padding: '0 2rem', fontWeight: 600, borderRadius: '10px' }} disabled={!qty || Number(qty) <= 0} onClick={() => setStep(4)}>
              Next Step &rarr;
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Calculations & Completion */}
      {step === 4 && calc && (
        <div>
          {/* Warnings */}
          {calc.isBulkLow && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#b91c1c', fontWeight: 700, fontSize: '0.9rem' }}>
              ⚠ Raw Material Shortage
            </div>
          )}
          {calc.isPouchLow && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#d97706', fontWeight: 700, fontSize: '0.9rem' }}>
              ⚠ Packaging Material Shortage
            </div>
          )}
          {calc.isLabelLow && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#d97706', fontWeight: 700, fontSize: '0.9rem' }}>
              ⚠ Label Shortage
            </div>
          )}

          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>Asset Consumption Breakdown</h3>
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '1.5rem' }}>
            <table className="data-table" style={{ margin: 0, fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '0.75rem' }}>Material Required</th>
                  <th style={{ padding: '0.75rem' }}>Required Qty</th>
                  <th style={{ padding: '0.75rem' }}>Stock Available</th>
                  <th style={{ padding: '0.75rem' }}>Cost</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>{selectedProduct?.name} (Bulk)</td>
                  <td style={{ padding: '0.75rem' }}>{calc.bulkQtyNeeded.toFixed(2)} {selectedProduct?.unit}</td>
                  <td style={{ padding: '0.75rem' }}>{Number(selectedProduct?.stock).toFixed(2)} {selectedProduct?.unit}</td>
                  <td style={{ padding: '0.75rem' }}>{fmt(calc.bulkCost)}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, background: calc.isBulkLow ? '#fef2f2' : '#f0fdf4', color: calc.isBulkLow ? '#dc2626' : '#16a34a' }}>
                      {calc.isBulkLow ? 'Shortage' : 'Available'}
                    </span>
                  </td>
                </tr>
                {calc.pouch && (
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{calc.pouch.name} (Pouch)</td>
                    <td style={{ padding: '0.75rem' }}>{qty} pcs</td>
                    <td style={{ padding: '0.75rem' }}>{Number(calc.pouch.stock).toFixed(0)} pcs</td>
                    <td style={{ padding: '0.75rem' }}>{fmt(calc.pouchCost)}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, background: calc.isPouchLow ? '#fef2f2' : '#f0fdf4', color: calc.isPouchLow ? '#dc2626' : '#16a34a' }}>
                        {calc.isPouchLow ? 'Shortage' : 'Available'}
                      </span>
                    </td>
                  </tr>
                )}
                {calc.label && (
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{calc.label.name} (Label)</td>
                    <td style={{ padding: '0.75rem' }}>{qty} pcs</td>
                    <td style={{ padding: '0.75rem' }}>{Number(calc.label.stock).toFixed(0)} pcs</td>
                    <td style={{ padding: '0.75rem' }}>{fmt(calc.labelCost)}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, background: calc.isLabelLow ? '#fef2f2' : '#f0fdf4', color: calc.isLabelLow ? '#dc2626' : '#16a34a' }}>
                        {calc.isLabelLow ? 'Shortage' : 'Available'}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Overheads */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Labor Cost (₹)</label>
              <input type="number" min="0" step="1" className="form-control" style={{ borderRadius: '8px' }} value={laborCost} onChange={(e) => setLaborCost(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Other Overhead (₹)</label>
              <input type="number" min="0" step="1" className="form-control" style={{ borderRadius: '8px' }} value={otherCost} onChange={(e) => setOtherCost(Number(e.target.value))} />
            </div>
          </div>

          {/* Costs box */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Repack Cost</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ff9800' }}>{fmt(calc.totalCost)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Cost Per Pack</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{fmt(calc.costPerUnit)}</div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Repacking Notes</label>
            <textarea className="form-control" style={{ borderRadius: '8px' }} rows={2} placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <button type="button" className="btn btn-secondary" style={{ height: '48px', padding: '0 1.5rem', borderRadius: '10px' }} onClick={() => setStep(3)}>
              &larr; Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', height: '48px', padding: '0 2.5rem', fontWeight: 700, borderRadius: '10px' }}
              disabled={calc.isBulkLow || calc.isPouchLow || calc.isLabelLow}
              onClick={handleCompleteRepacking}
            >
              COMPLETE REPACKING
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Success screen */}
      {step === 5 && (
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <span style={{ fontSize: '4.5rem', color: '#10b981', display: 'block', marginBottom: '1rem' }}>🎉</span>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', margin: '0 0 0.5rem 0' }}>Repacking Completed!</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
            Bulk stock reduced and repacked target packages stock successfully updated in inventory.
          </p>
          <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', height: '48px', padding: '0 2rem', fontWeight: 600, borderRadius: '10px' }} onClick={resetEntry}>
            Repack Another Item
          </button>
        </div>
      )}

      {/* Collapsible Admin Debugging Panel */}
      <div style={{ marginTop: '2.5rem', borderTop: '1px dashed #cbd5e1', paddingTop: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setShowDebug(!showDebug)}
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            margin: '0 auto'
          }}
        >
          🔧 {showDebug ? 'Hide' : 'Show'} Admin Debugging Panel
        </button>
        
        {showDebug && (
          <div style={{ marginTop: '1rem', background: '#0f172a', color: '#e2e8f0', padding: '1.25rem', borderRadius: '12px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 'bold', color: '#ff9800', marginBottom: '0.75rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
              Product Visibility Debugger (All Products)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '0.5rem 0' }}>Product Name</th>
                  <th>Product Type</th>
                  <th>Current Stock</th>
                  <th>Supplier</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const isVisible = p.productType === 'repacking';
                  return (
                    <tr key={p.id || p._id} style={{ borderBottom: '1px solid #1e293b', color: isVisible ? '#4ade80' : '#94a3b8' }}>
                      <td style={{ padding: '0.5rem 0' }}>{p.name}</td>
                      <td>{p.productType || 'NULL'}</td>
                      <td>{p.stock} {p.unit}</td>
                      <td>{p.supplier || '—'}</td>
                      <td>
                        <span style={{
                          backgroundColor: isVisible ? '#064e3b' : '#312e81',
                          color: isVisible ? '#6ee7b7' : '#c7d2fe',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.7rem'
                        }}>
                          {isVisible ? 'VISIBLE' : 'HIDDEN'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
              * To make a product visible in Repacking Entry, its Product Type must be set to <strong>repacking</strong> (Repacking Product) in the Product Master.
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// -------------------------------------------------------------
// sub-component: BATCH DETAILS MODAL
// -------------------------------------------------------------
function BatchDetailsModal({ batch, onClose }) {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    async function loadDetails() {
      setLoading(true);
      try {
        if (batch.batchType === 'repacking') {
          const res = await repackApi.get(batch.id || batch._id);
          setDetails(res.data);
        } else {
          setDetails(batch);
        }
      } catch {
        toast('Failed to load details', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [batch, toast]);

  const handlePrint = () => {
    const printContent = document.getElementById('batch-print-area').innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>Batch Order #${batch.batchNumber}</title>
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
          <div class="header-bar">
            <h2>Amudhasurabiy Organics ERP</h2>
            <h3>Production Batch Log: #${batch.batchNumber}</h3>
          </div>
          ${printContent}
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <Modal title={`📄 Batch Run Details: ${batch.batchNumber}`} onClose={onClose} footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Close</button><button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }} onClick={handlePrint}>Print</button></>}>
      {loading ? <LoadingSpinner /> : (
        <div id="batch-print-area">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            <div>
              <span style={{ color: '#64748b' }}>Date Logged:</span>
              <strong style={{ display: 'block' }}>{new Date(batch.date || batch.createdAt).toLocaleString()}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Produced Yield Item:</span>
              <strong style={{ display: 'block' }}>{batch.qtyToProduce} {batch.productUnit} of {batch.productName}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Recipe Used:</span>
              <strong style={{ display: 'block' }}>{batch.recipeName}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Logged By:</span>
              <strong style={{ display: 'block' }}>{batch.createdBy?.name || 'ERP System'}</strong>
            </div>
          </div>

          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '1rem 0 0.5rem 0' }}>Consumed Raw materials & packaging</h4>
          <table className="data-table" style={{ fontSize: '0.8rem', width: '100%', marginBottom: '1.5rem' }}>
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Quantity Consumed</th>
                <th>Unit Cost</th>
                <th>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {batch.batchType === 'manufacturing' ? (
                details.materials?.map((m, idx) => (
                  <tr key={idx}>
                    <td>{m.rawMaterial?.name || 'Raw Ingredient'}</td>
                    <td>{m.qtyUsed} {m.rawMaterial?.unit || 'Kg'}</td>
                    <td>{fmt(m.unitCost)}</td>
                    <td>{fmt(m.totalCost)}</td>
                  </tr>
                ))
              ) : (
                <>
                  {/* For repack bulk source */}
                  <tr>
                    <td>{details.finishedProduct?.name} (Bulk source product)</td>
                    <td>
                      {((Number(details.qtyToProduce) * Number(details.packSize?.weightInGrams || 0)) / 1000).toFixed(2)} Kg
                      {Number(details.lossQty || 0) > 0 && ` + ${Number(details.lossQty).toFixed(2)} Kg Loss`}
                    </td>
                    <td>{fmt(details.finishedProduct?.purchasePrice)}</td>
                    <td>{fmt(details.rawMaterialCost)}</td>
                  </tr>
                  {/* packaging materials snapped */}
                  {details.materials?.map((m, idx) => (
                    <tr key={idx}>
                      <td>{m.product?.name || 'Packaging Asset'}</td>
                      <td>{m.qtyUsed} pcs</td>
                      <td>{fmt(m.unitCost)}</td>
                      <td>{fmt(m.totalCost)}</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>

          <div style={{ background: '#fafafa', border: '1px dashed #ff9800', borderRadius: '8px', padding: '1rem', width: '280px', float: 'right', fontSize: '0.85rem' }}>
            {batch.batchType === 'repacking' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Bulk Product Cost:</span>
                  <strong>{fmt(batch.rawMaterialCost)}</strong>
                </div>
                {details?.lossQty > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', color: '#ef4444' }}>
                    <span>Loss / Wastage:</span>
                    <strong>{details.lossQty} Kg</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Packaging Materials Cost:</span>
                  <strong>{fmt(details?.packingMaterialCost)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Labor Cost:</span>
                  <strong>{fmt(batch.laborCost)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Overhead Cost:</span>
                  <strong>{fmt(batch.otherCost)}</strong>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Raw Materials Cost:</span>
                  <strong>{fmt(batch.rawMaterialCost)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Packaging Cost:</span>
                  <strong>{fmt(batch.packagingCost)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Labor Cost:</span>
                  <strong>{fmt(batch.laborCost)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Overhead Cost:</span>
                  <strong>{fmt(batch.overheadCost)}</strong>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', paddingTop: '0.5rem', marginTop: '0.5rem', fontWeight: 800, color: '#ff9800', fontSize: '0.95rem' }}>
              <span>Total Cost:</span>
              <span>{fmt(batch.totalCost)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>
              <span>Cost Per Unit:</span>
              <span>{fmt(batch.costPerUnit)}</span>
            </div>
          </div>
          <div style={{ clear: 'both' }}></div>
        </div>
      )}
    </Modal>
  );
}

// -------------------------------------------------------------
// sub-component: RECIPES CREATOR / EDITOR MODAL
// -------------------------------------------------------------
function RecipeFormModal({ type, form, setForm, products, rawMaterials, onClose, onSave }) {
  const isMfg = type.endsWith('_mfg');

  const addIngredient = () => {
    if (isMfg) {
      setForm({ ...form, materials: [...form.materials, { rawMaterialId: '', qty: '' }] });
    } else {
      setForm({ ...form, materials: [...form.materials, { productId: '', qty: 1 }] });
    }
  };

  const removeIngredient = (idx) => {
    const updated = form.materials.filter((_, i) => i !== idx);
    setForm({ ...form, materials: updated });
  };

  const handleIngredientChange = (idx, field, val) => {
    const updated = [...form.materials];
    updated[idx][field] = val;
    setForm({ ...form, materials: updated });
  };

  const getModalRecipeCost = () => {
    let total = 0;
    const items = form.materials || [];
    for (const m of items) {
      if (isMfg) {
        const rm = rawMaterials.find(r => String(r.id) === String(m.rawMaterialId));
        if (rm) total += Number(m.qty || 0) * Number(rm.purchasePrice || 0);
      } else {
        const p = products.find(prod => String(prod.id || prod._id) === String(m.productId));
        if (p) total += Number(m.qty || 0) * Number(p.purchasePrice || 0);
      }
    }
    return total;
  };

  const selectedProduct = products.find(p => String(p.id || p._id) === String(form.productId));
  const variants = selectedProduct 
    ? products.filter(p => String(p.parentProductId) === String(selectedProduct.id || selectedProduct._id) && !p.isArchived)
    : [];

  const handleProductChange = (val) => {
    setForm({
      ...form,
      productId: val,
      variantProductId: '',
      packSize: 'Bulk',
      yieldQty: 1.0,
      yieldPacks: '',
      packWeight: '',
    });
  };

  const handleVariantChange = (val) => {
    if (val === 'Bulk' || !val) {
      setForm({
        ...form,
        variantProductId: '',
        packSize: 'Bulk',
        packWeight: '',
        yieldQty: 1.0,
        yieldPacks: '',
      });
    } else {
      const selectedVariant = variants.find(v => String(v.id || v._id) === String(val));
      const weight = selectedVariant ? Number(selectedVariant.conversionFactor || 0.2) : 0.2;
      const packs = Number(form.yieldPacks) || 30;
      setForm({
        ...form,
        variantProductId: val,
        packSize: selectedVariant?.packSize || '',
        packWeight: weight,
        yieldPacks: packs,
        yieldQty: packs * weight,
      });
    }
  };

  const handlePacksChange = (packsVal) => {
    const packs = Number(packsVal) || 0;
    const weight = Number(form.packWeight) || 0.2;
    setForm({
      ...form,
      yieldPacks: packs,
      yieldQty: packs * weight,
    });
  };

  const modalCost = getModalRecipeCost();
  const yieldQuantityVal = Number(form.yieldQty) || 1;
  const modalCostPerUnit = yieldQuantityVal > 0 ? (modalCost / yieldQuantityVal) : 0;

  return (
    <Modal
      title={type.startsWith('create') ? (isMfg ? '🏭 Add Production Recipe' : '🔄 Add Repacking Formula') : (isMfg ? '🏭 Edit Production Recipe' : '🔄 Edit Repacking Formula')}
      className="modal-lg"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }} onClick={onSave}>Save Recipe</button>
        </>
      )}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div className="form-group">
          <label>Recipe Name *</label>
          <input className="form-control" value={isMfg ? form.name : form.recipeName} onChange={(e) => setForm(isMfg ? { ...form, name: e.target.value } : { ...form, recipeName: e.target.value })} required />
        </div>
        <div className="form-group">
          <label>Target Yield Product *</label>
          {isMfg ? (
            <select className="form-control" value={form.productId} onChange={(e) => handleProductChange(e.target.value)} required>
              <option value="">Choose Target Product...</option>
              {products.filter(p => p.productType === 'BULK_PRODUCT').map(p => (
                <option key={p.id || p._id} value={p.id || p._id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          ) : (
            <select className="form-control" value={form.finishedProductId} onChange={(e) => setForm({ ...form, finishedProductId: e.target.value })} required>
              <option value="">Choose Finished Product...</option>
              {products.map(p => (
                <option key={p.id || p._id} value={p.id || p._id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {isMfg ? (
        /* Enhanced fields for Production Recipe */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div className="form-group">
            <label>Pack Size *</label>
            <select className="form-control" value={form.variantProductId || 'Bulk'} onChange={(e) => handleVariantChange(e.target.value)} required>
              <option value="Bulk">○ Bulk</option>
              {variants.map(v => (
                <option key={v.id || v._id} value={v.id || v._id}>○ {v.packSize || v.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{form.variantProductId ? 'Yield Packs *' : 'Yield Quantity (KG) *'}</label>
            {form.variantProductId ? (
              <input type="number" className="form-control" value={form.yieldPacks || ''} onChange={(e) => handlePacksChange(e.target.value)} required />
            ) : (
              <input type="number" step="0.01" className="form-control" value={form.yieldQty} onChange={(e) => setForm({ ...form, yieldQty: Number(e.target.value) })} required />
            )}
          </div>
          <div className="form-group">
            <label>Wastage Allowance %</label>
            <input type="number" step="0.1" className="form-control" placeholder="0.0" value={form.wastagePercent} onChange={(e) => setForm({ ...form, wastagePercent: Number(e.target.value) })} />
          </div>
        </div>
      ) : (
        /* Repacking recipe legacy fields */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div className="form-group">
            <label>Yield Output Quantity *</label>
            <input type="number" step="0.01" className="form-control" value={form.finishedQty} onChange={(e) => setForm({ ...form, finishedQty: Number(e.target.value) })} required />
          </div>
          <div className="form-group">
            <label>Unit</label>
            <input className="form-control" value={form.unit} placeholder="e.g. packs" onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Wastage Allowance %</label>
            <input type="number" step="0.1" className="form-control" placeholder="0.0" value={form.wastagePercent} onChange={(e) => setForm({ ...form, wastagePercent: Number(e.target.value) })} />
          </div>
        </div>
      )}

      {isMfg && form.variantProductId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div className="form-group">
            <label>Pack Weight</label>
            <input className="form-control" value={form.packWeight ? `${Number(form.packWeight) * 1000}g (${form.packWeight} KG)` : ''} disabled />
          </div>
          <div className="form-group">
            <label>Calculated Output Weight</label>
            <input className="form-control" value={`${(Number(form.yieldQty) || 0).toFixed(2)} KG`} disabled />
          </div>
        </div>
      )}

      {/* Live Manufacturing Preview Card */}
      {isMfg && (
        <div style={{
          background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1rem',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)',
        }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📊 Recipe Output Preview
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', fontSize: '0.9rem' }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Target Product</span>
              <strong style={{ color: '#0f172a' }}>{selectedProduct?.name || 'None'}</strong>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Pack Size</span>
              <strong style={{ color: '#0f172a' }}>
                {form.variantProductId ? (variants.find(v => String(v.id || v._id) === String(form.variantProductId))?.packSize || 'Variant') : 'Bulk'}
              </strong>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Yield Quantity</span>
              <strong style={{ color: '#0f172a' }}>
                {form.variantProductId ? `${form.yieldPacks || 0} Packs` : `${form.yieldQty || 0} KG`}
              </strong>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Total Weight</span>
              <strong style={{ color: '#10b981', fontSize: '1.05rem' }}>
                {Number(form.yieldQty || 0).toFixed(2)} KG
              </strong>
            </div>
          </div>
        </div>
      )}

      <div className="form-group">
        <label>Formulation Notes / Instructions</label>
        <textarea className="form-control" rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <strong>📝 Recipe Components (Ingredients)</strong>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addIngredient}>+ Add Ingredient</button>
        </div>
        
        <div style={{ maxHeight: '220px', overflowY: 'auto', paddingRight: '0.25rem' }}>
          {form.materials?.map((mat, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {isMfg ? (
                /* Mfg raw material ingredients list */
                <select style={{ flex: 2 }} className="form-control form-control-sm" value={mat.rawMaterialId} onChange={(e) => handleIngredientChange(idx, 'rawMaterialId', e.target.value)} required>
                  <option value="">Select Raw Material / Ingredient...</option>
                  {rawMaterials.map(rm => (
                    <option key={rm.id} value={rm.id}>{rm.name} ({rm.materialCode}) [Stock: {rm.stock} {rm.unit} | Cost: ₹{Number(rm.purchasePrice || 0).toFixed(1)}/{rm.unit}]</option>
                  ))}
                </select>
              ) : (
                /* Repack bulk finished product input */
                <select style={{ flex: 2 }} className="form-control form-control-sm" value={mat.productId} onChange={(e) => handleIngredientChange(idx, 'productId', e.target.value)} required>
                  <option value="">Select Bulk Source Product...</option>
                  {products.map(p => (
                    <option key={p.id || p._id} value={p.id || p._id}>{p.name} ({p.sku}) [Stock: {p.stock} {p.unit} | Cost: ₹{Number(p.purchasePrice || 0).toFixed(1)}/{p.unit}]</option>
                  ))}
                </select>
              )}
              <input style={{ flex: 1 }} type="number" step="0.0001" className="form-control form-control-sm" placeholder="Quantity needed" value={mat.qty} onChange={(e) => handleIngredientChange(idx, 'qty', Number(e.target.value))} required />
              <button type="button" className="btn btn-danger btn-sm" style={{ padding: '0.1rem 0.4rem', fontSize: '1rem' }} onClick={() => removeIngredient(idx)} disabled={form.materials.length <= 1}>&times;</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
        <div>
          <span>Estimated Recipe Cost:</span>
          <strong style={{ display: 'block', color: '#ff9800', fontSize: '1.1rem', fontWeight: 800 }}>{fmt(modalCost)}</strong>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span>Cost Per Yield Unit:</span>
          <strong style={{ display: 'block', color: '#0f172a', fontSize: '1.1rem', fontWeight: 800 }}>{fmt(modalCostPerUnit)}</strong>
        </div>
      </div>
    </Modal>
  );
}

// -------------------------------------------------------------
// sub-component: EDIT REPACK MODAL
// -------------------------------------------------------------
function EditRepackModal({ batch, onClose, onRefresh, products, rawMaterials }) {
  const [qty, setQty] = useState(batch.qtyToProduce);
  const [lossQty, setLossQty] = useState(batch.lossQty || 0);
  const [laborCost, setLaborCost] = useState(batch.laborCost || 0);
  const [otherCost, setOtherCost] = useState(batch.otherCost || 0);
  const [notes, setNotes] = useState(batch.notes || '');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!qty || Number(qty) <= 0) {
      toast('Please enter a valid quantity.', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        qtyToProduce: Number(qty),
        lossQty: Number(lossQty),
        laborCost: Number(laborCost),
        otherCost: Number(otherCost),
        notes,
      };
      await repackApi.update(batch.id || batch._id, payload);
      toast('Repacking run successfully updated!', 'success');
      onRefresh();
      onClose();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to update repacking run.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`✏️ Edit Repacking Run: ${batch.batchNumber}`} onClose={onClose} footer={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button><button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }} onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button></>}>
      <form onSubmit={handleSave}>
        <div style={{ marginBottom: '1.25rem', background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
          <strong>Product:</strong> {batch.productName}
          <br />
          <strong>Formula / Pack Size:</strong> {batch.recipeName}
        </div>

        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#334155', display: 'block', marginBottom: '0.4rem' }}>Number of Packs to Produce</label>
          <input
            type="number"
            min="1"
            step="1"
            className="form-control"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            required
          />
        </div>

        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#334155', display: 'block', marginBottom: '0.4rem' }}>Loss / Wastage Quantity (Kg)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="form-control"
            value={lossQty}
            onChange={(e) => setLossQty(Number(e.target.value))}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#334155', display: 'block', marginBottom: '0.4rem' }}>Labor Cost (₹)</label>
            <input
              type="number"
              min="0"
              className="form-control"
              value={laborCost}
              onChange={(e) => setLaborCost(Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#334155', display: 'block', marginBottom: '0.4rem' }}>Other Overhead (₹)</label>
            <input
              type="number"
              min="0"
              className="form-control"
              value={otherCost}
              onChange={(e) => setOtherCost(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
          <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#334155', display: 'block', marginBottom: '0.4rem' }}>Notes</label>
          <textarea
            className="form-control"
            rows="3"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}

function PackingConversionTab({ products, loadSystemData }) {
  const { toast } = useToast();
  const [conversions, setConversions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [detailConversion, setDetailConversion] = useState(null);

  // Wizard States
  const [sourceProductId, setSourceProductId] = useState('');
  const [notes, setNotes] = useState('');
  const [targets, setTargets] = useState([{ targetProductId: '', qty: '' }]);

  const loadConversions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await packingConversionApi.list();
      setConversions(res.data || []);
    } catch (err) {
      console.error(err);
      toast('Failed to load packing conversions list', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadConversions();
  }, [loadConversions]);

  const bulkProducts = products.filter(p => p.productType === 'BULK_PRODUCT');

  const selectedBulk = products.find(p => String(p._id || p.id) === String(sourceProductId));
  const availableVariants = selectedBulk 
    ? products.filter(p => String(p.parentProductId) === String(selectedBulk._id || selectedBulk.id) && ['RETAIL_PACK', 'LABEL_PACK'].includes(p.productType))
    : [];

  const handleAddTarget = () => {
    setTargets([...targets, { targetProductId: '', qty: '' }]);
  };

  const handleRemoveTarget = (index) => {
    const list = [...targets];
    list.splice(index, 1);
    setTargets(list);
  };

  const handleTargetChange = (index, field, value) => {
    const list = [...targets];
    list[index][field] = value;
    setTargets(list);
  };

  const handleQuickAdd = (index, amount) => {
    const list = [...targets];
    const currentQty = Number(list[index].qty) || 0;
    list[index].qty = currentQty + amount;
    setTargets(list);
  };

  const handleResetQty = (index) => {
    const list = [...targets];
    list[index].qty = '';
    setTargets(list);
  };

  // Calculations for live preview
  let totalWeightConsumed = 0;
  targets.forEach(item => {
    const targetProduct = products.find(p => String(p._id || p.id) === String(item.targetProductId));
    const qty = Number(item.qty) || 0;
    const factor = Number(targetProduct?.conversionFactor || 0);
    totalWeightConsumed += qty * factor;
  });

  const availableStock = selectedBulk ? Number(selectedBulk.stock || 0) : 0;
  const remainingStock = availableStock - totalWeightConsumed;
  const isStockInsufficient = remainingStock < 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sourceProductId) {
      toast('Please select a source bulk product.', 'warning');
      return;
    }
    const filteredItems = targets.filter(t => t.targetProductId && Number(t.qty) > 0);
    if (filteredItems.length === 0) {
      toast('Please add at least one target variant with positive quantity.', 'warning');
      return;
    }
    if (isStockInsufficient) {
      toast('Cannot perform packing conversion due to insufficient bulk stock.', 'error');
      return;
    }

    try {
      const payload = {
        sourceProductId,
        notes: notes || 'Packed powder stock into packs.',
        items: filteredItems.map(item => ({
          targetProductId: item.targetProductId,
          qty: Number(item.qty)
        }))
      };
      await packingConversionApi.create(payload);
      toast('Packing conversion recorded successfully!', 'success');
      setShowWizard(false);
      
      // Reset form
      setSourceProductId('');
      setNotes('');
      setTargets([{ targetProductId: '', qty: '' }]);
      
      // Reload
      loadConversions();
      loadSystemData();
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || 'Failed to record packing conversion', 'error');
    }
  };

  const handleReverse = async (id) => {
    if (!confirm('Are you sure you want to REVERSE this packing run? Bulk stock will be returned and pack stocks will be deducted. This action cannot be undone.')) return;
    try {
      await packingConversionApi.reverse(id);
      toast('Packing conversion reversed successfully', 'success');
      loadConversions();
      loadSystemData();
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || 'Failed to reverse packing conversion', 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          📦 Packing Conversion Run logs
        </h2>
        <button
          type="button"
          className="btn btn-primary"
          style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', fontWeight: 600 }}
          onClick={() => setShowWizard(true)}
        >
          + New Packing Conversion
        </button>
      </div>

      <div className="card table-wrap">
        {loading ? <LoadingSpinner /> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Run #</th>
                <th>Source Bulk</th>
                <th>Total Consumed</th>
                <th>Status</th>
                <th>User</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {conversions.map((run) => (
                <tr key={run.id}>
                  <td>{new Date(run.date).toLocaleDateString()}</td>
                  <td><strong>{run.conversionNumber}</strong></td>
                  <td>{run.sourceProduct?.name || 'Unknown Bulk'}</td>
                  <td>{Number(run.sourceQty || 0).toFixed(2)} {run.sourceProduct?.unit || 'Kg'}</td>
                  <td>
                    <span className={`badge ${run.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>
                      {run.status.toUpperCase()}
                    </span>
                  </td>
                  <td>{run.createdBy?.name || 'ERP System'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => setDetailConversion(run)}
                      >
                        Details
                      </button>
                      {run.status === 'completed' && (
                        <button 
                          type="button" 
                          className="btn btn-danger btn-sm" 
                          onClick={() => handleReverse(run.id)}
                        >
                          Reverse
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {conversions.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No packing conversions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {detailConversion && (
        <Modal 
          title={`📄 Packing Run Details: ${detailConversion.conversionNumber}`} 
          onClose={() => setDetailConversion(null)}
          footer={<button type="button" className="btn btn-secondary" onClick={() => setDetailConversion(null)}>Close</button>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            <div>
              <span style={{ color: '#64748b' }}>Date Logged:</span>
              <strong style={{ display: 'block' }}>{new Date(detailConversion.date).toLocaleString()}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Source Bulk:</span>
              <strong style={{ display: 'block' }}>{detailConversion.sourceProduct?.name} ({detailConversion.sourceProduct?.sku})</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Total Consumed:</span>
              <strong style={{ display: 'block' }}>{Number(detailConversion.sourceQty || 0).toFixed(2)} {detailConversion.sourceProduct?.unit || 'Kg'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Logged By:</span>
              <strong style={{ display: 'block' }}>{detailConversion.createdBy?.name || 'ERP System'}</strong>
            </div>
          </div>
          {detailConversion.notes && (
            <div style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              <span style={{ color: '#64748b' }}>Notes:</span>
              <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px', marginTop: '0.25rem' }}>{detailConversion.notes}</div>
            </div>
          )}

          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '1rem 0 0.5rem 0' }}>Packed Target Variants</h4>
          <table className="data-table" style={{ fontSize: '0.8rem', width: '100%' }}>
            <thead>
              <tr>
                <th>Target Pack Variant</th>
                <th>SKU</th>
                <th>Packs Produced</th>
                <th>Pack Factor (Kg)</th>
                <th>Total Weight (Kg)</th>
              </tr>
            </thead>
            <tbody>
              {detailConversion.items?.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{item.targetProduct?.name}</td>
                  <td>{item.targetProduct?.sku}</td>
                  <td>{item.qty} pcs</td>
                  <td>{Number(item.conversionFactor || 0).toFixed(4)} Kg</td>
                  <td>{Number(item.totalWeight || 0).toFixed(2)} Kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {/* Wizard Overlay (Modal) */}
      {showWizard && (
        <Modal 
          title="⚡ Execute Packing Conversion Run" 
          onClose={() => setShowWizard(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowWizard(false)}>Cancel</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }}
                disabled={isStockInsufficient || !sourceProductId || targets.filter(t => t.targetProductId && Number(t.qty) > 0).length === 0}
                onClick={handleSubmit}
              >
                Confirm Packing Run
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: 600 }}>1. Select Source Bulk Product</label>
              <select
                className="form-control"
                style={{ width: '100%', height: '42px', borderRadius: '8px' }}
                value={sourceProductId}
                onChange={(e) => {
                  setSourceProductId(e.target.value);
                  setTargets([{ targetProductId: '', qty: '' }]);
                }}
              >
                <option value="">-- Choose Bulk Powder --</option>
                {bulkProducts.map(p => (
                  <option key={p._id || p.id} value={p._id || p.id}>
                    {p.name} (SKU: {p.sku}) [Stock: {p.stock} {p.unit || 'Kg'}]
                  </option>
                ))}
              </select>
            </div>

            {selectedBulk && (
              <div style={{ background: 'var(--brand-primary-light, #fff7ed)', border: '1px solid #ffedd5', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: '#c2410c', fontWeight: 600 }}>Available Bulk Stock:</span>
                <strong style={{ color: '#c2410c' }}>{availableStock.toFixed(2)} {selectedBulk.unit || 'Kg'}</strong>
              </div>
            )}

            {sourceProductId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>2. Add Target Retail / Label Pack Sizes</span>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    onClick={handleAddTarget}
                  >
                    + Add Row
                  </button>
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {targets.map((item, idx) => {
                    const selTarget = products.find(p => String(p._id || p.id) === String(item.targetProductId));
                    return (
                      <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', position: 'relative', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {targets.length > 1 && (
                          <button
                            type="button"
                            style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'transparent', border: 'none', color: '#ef4444', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}
                            onClick={() => handleRemoveTarget(idx)}
                          >
                            ×
                          </button>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Target Pack Variant</span>
                          <select
                            className="form-control"
                            style={{ width: '100%', height: '38px', borderRadius: '6px' }}
                            value={item.targetProductId}
                            onChange={(e) => handleTargetChange(idx, 'targetProductId', e.target.value)}
                          >
                            <option value="">-- Choose Pack Variant --</option>
                            {availableVariants.map(v => (
                              <option key={v._id || v.id} value={v._id || v.id} disabled={targets.some((t, tIdx) => tIdx !== idx && String(t.targetProductId) === String(v._id || v.id))}>
                                {v.packSize || v.name} (SKU: {v.sku}) [Factor: {v.conversionFactor} Kg]
                              </option>
                            ))}
                          </select>
                        </div>

                        {item.targetProductId && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Quantity (Packs)</span>
                              {selTarget && (
                                <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                                  Weight: <strong>{((Number(item.qty) || 0) * Number(selTarget.conversionFactor)).toFixed(2)} Kg</strong>
                                </span>
                              )}
                            </div>
                            <input
                              type="number"
                              className="form-control"
                              style={{ width: '100%', height: '38px', borderRadius: '6px' }}
                              placeholder="e.g. 50"
                              min="1"
                              value={item.qty}
                              onChange={(e) => handleTargetChange(idx, 'qty', e.target.value)}
                            />
                            {/* Quick Add Buttons */}
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                              <button 
                                type="button" 
                                className="btn btn-secondary btn-sm"
                                style={{ flex: '1', padding: '0.5rem', height: '38px', minWidth: '60px', fontWeight: 600 }}
                                onClick={() => handleQuickAdd(idx, 10)}
                              >
                                +10
                              </button>
                              <button 
                                type="button" 
                                className="btn btn-secondary btn-sm"
                                style={{ flex: '1', padding: '0.5rem', height: '38px', minWidth: '60px', fontWeight: 600 }}
                                onClick={() => handleQuickAdd(idx, 50)}
                              >
                                +50
                              </button>
                              <button 
                                type="button" 
                                className="btn btn-secondary btn-sm"
                                style={{ flex: '1', padding: '0.5rem', height: '38px', minWidth: '60px', fontWeight: 600 }}
                                onClick={() => handleQuickAdd(idx, 100)}
                              >
                                +100
                              </button>
                              <button 
                                type="button" 
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.5rem', height: '38px', color: '#ef4444', borderColor: '#fecaca', fontWeight: 600 }}
                                onClick={() => handleResetQty(idx)}
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Live Preview section */}
            {sourceProductId && (
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem', background: '#f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', color: '#475569' }}>Live Conversion Preview</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>Total Weight to Consume:</span>
                  <strong>{totalWeightConsumed.toFixed(2)} Kg</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>Remaining Bulk Stock:</span>
                  <span style={{ fontWeight: 700, color: isStockInsufficient ? '#dc2626' : '#16a34a' }}>
                    {remainingStock.toFixed(2)} Kg
                  </span>
                </div>
                {isStockInsufficient && (
                  <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, marginTop: '0.25rem', textAlign: 'center' }}>
                    🚨 Error: Total weight to consume exceeds available bulk stock!
                  </div>
                )}
              </div>
            )}

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontWeight: 600 }}>Notes / Remarks</label>
              <textarea
                className="form-control"
                style={{ width: '100%', borderRadius: '6px', minHeight: '60px' }}
                placeholder="Optional remarks e.g. Batch shift B"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
