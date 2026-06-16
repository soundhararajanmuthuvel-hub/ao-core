import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Inventory from './Inventory';
import RawMaterials from './RawMaterials';
import PackagingMaterials from './PackagingMaterials';
import Products from './Products';
import { productsApi, rawMaterialsApi, inventoryApi } from '../api';
import { useToast } from '../context/ToastContext';

export default function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'summary';
  const { toast } = useToast();

  const [productsList, setProductsList] = useState([]);
  const [rawMaterialsList, setRawMaterialsList] = useState([]);
  
  // Batch tracking states
  const [batchProdId, setBatchProdId] = useState('');
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Loss Register states
  const [lossDashboard, setLossDashboard] = useState({ monthlyLossValue: 0, lossPercentage: 0 });
  const [losses, setLosses] = useState([]);
  const [loadingLosses, setLoadingLosses] = useState(false);

  // Loss Form states
  const [lossItemType, setLossItemType] = useState('finished_goods');
  const [lossProdId, setLossProdId] = useState('');
  const [lossRMId, setLossRMId] = useState('');
  const [lossQty, setLossQty] = useState('');
  const [lossReason, setLossReason] = useState('Production Loss');
  const [lossNotes, setLossNotes] = useState('');

  const setTab = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  // Load products & raw materials lists
  useEffect(() => {
    productsApi.list({ limit: 1000 }).then(res => {
      setProductsList(res.data.products || []);
    }).catch(err => console.error(err));

    rawMaterialsApi.list({ limit: 1000 }).then(res => {
      setRawMaterialsList(res.data.materials || []);
    }).catch(err => console.error(err));
  }, []);

  // Fetch batches when selected product changes
  useEffect(() => {
    if (!batchProdId) {
      setBatches([]);
      return;
    }
    setLoadingBatches(true);
    inventoryApi.getProductBatches(batchProdId).then(res => {
      setBatches(res.data || []);
    }).catch(err => {
      toast('Failed to load product batches', 'error');
    }).finally(() => {
      setLoadingBatches(false);
    });
  }, [batchProdId, toast]);

  // Load Loss dashboard & register
  const loadLossData = () => {
    setLoadingLosses(true);
    Promise.all([
      inventoryApi.getLossDashboard(),
      inventoryApi.getLossRegister()
    ]).then(([dashRes, regRes]) => {
      setLossDashboard(dashRes.data || { monthlyLossValue: 0, lossPercentage: 0 });
      setLosses(regRes.data || []);
    }).catch(err => {
      toast('Failed to load stock loss data', 'error');
    }).finally(() => {
      setLoadingLosses(false);
    });
  };

  useEffect(() => {
    if (currentTab === 'loss') {
      loadLossData();
    }
  }, [currentTab]);

  const handleCreateLoss = async (e) => {
    e.preventDefault();
    if (lossItemType === 'finished_goods' && !lossProdId) {
      toast('Please select a product', 'error');
      return;
    }
    if (lossItemType !== 'finished_goods' && !lossRMId) {
      toast('Please select a material', 'error');
      return;
    }
    if (!lossQty || Number(lossQty) <= 0) {
      toast('Please enter a positive quantity', 'error');
      return;
    }

    try {
      await inventoryApi.createLoss({
        itemType: lossItemType,
        productId: lossItemType === 'finished_goods' ? Number(lossProdId) : null,
        rawMaterialId: lossItemType !== 'finished_goods' ? Number(lossRMId) : null,
        quantity: Number(lossQty),
        reason: lossReason,
        notes: lossNotes
      });
      toast('Stock loss logged successfully', 'success');
      
      // Reset form
      setLossQty('');
      setLossNotes('');
      
      // Reload
      loadLossData();
      
      // Also refresh base products and materials stock levels in memory
      productsApi.list({ limit: 1000 }).then(res => setProductsList(res.data.products || []));
      rawMaterialsApi.list({ limit: 1000 }).then(res => setRawMaterialsList(res.data.materials || []));
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to log stock loss', 'error');
    }
  };

  return (
    <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            📋 Inventory Control & Tracking
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
            Monitor Stock Levels, review adjustments, log raw inventory, and track stock movements.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="rm-tabs-bar" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem', gap: '0.5rem', overflowX: 'auto' }}>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'summary' ? 'active' : ''}`}
          onClick={() => setTab('summary')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'summary' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'summary' ? '#ff9800' : '#64748b',
          }}
        >
          📈 Stock Summary
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'raw-materials' ? 'active' : ''}`}
          onClick={() => setTab('raw-materials')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'raw-materials' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'raw-materials' ? '#ff9800' : '#64748b',
          }}
        >
          🌾 Raw Materials
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'packaging' ? 'active' : ''}`}
          onClick={() => setTab('packaging')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'packaging' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'packaging' ? '#ff9800' : '#64748b',
          }}
        >
          🏷️ Packaging
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'finished' ? 'active' : ''}`}
          onClick={() => setTab('finished')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'finished' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'finished' ? '#ff9800' : '#64748b',
          }}
        >
          🎁 Finished Goods
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'batches' ? 'active' : ''}`}
          onClick={() => setTab('batches')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'batches' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'batches' ? '#ff9800' : '#64748b',
          }}
        >
          🏷️ Batch Tracking
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'loss' ? 'active' : ''}`}
          onClick={() => setTab('loss')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'loss' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'loss' ? '#ff9800' : '#64748b',
          }}
        >
          🚨 Loss & Damage
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setTab('alerts')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'alerts' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'alerts' ? '#ff9800' : '#64748b',
          }}
        >
          ⚠️ Low Stock Alerts
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'movements' ? 'active' : ''}`}
          onClick={() => setTab('movements')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'movements' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'movements' ? '#ff9800' : '#64748b',
          }}
        >
          🔄 Stock Movements
        </button>
      </div>

      <div className="tab-content" style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
        {currentTab === 'summary' && <Inventory defaultTab="report" />}
        {currentTab === 'raw-materials' && <RawMaterials />}
        {currentTab === 'packaging' && <PackagingMaterials />}
        {currentTab === 'finished' && <Products />}
        {currentTab === 'alerts' && <Inventory defaultTab="report" />}
        {currentTab === 'movements' && <Inventory defaultTab="movements" />}

        {/* Batch Tracking Tab */}
        {currentTab === 'batches' && (
          <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', backgroundColor: '#fff' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Manufactured Batches & FIFO Expiries</h3>
            <div style={{ maxWidth: '300px', marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Select Finished Good</label>
              <select className="form-control" value={batchProdId} onChange={(e) => setBatchProdId(e.target.value)}>
                <option value="">-- Choose Product --</option>
                {productsList.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>
                ))}
              </select>
            </div>

            {loadingBatches ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Loading batches...</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Batch Number</th>
                    <th>Expiry Date</th>
                    <th>Manufactured Qty</th>
                    <th>Sold Qty</th>
                    <th>Remaining Qty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map(b => {
                    const isExpired = b.expiryDate ? new Date(b.expiryDate) < new Date() : false;
                    return (
                      <tr key={b.batchNumber}>
                        <td><strong>{b.batchNumber}</strong></td>
                        <td>{b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : 'N/A'}</td>
                        <td>{Number(b.manufacturedQty).toFixed(2)} Kg</td>
                        <td>{Number(b.soldQty).toFixed(2)} Kg</td>
                        <td>
                          <span className={Number(b.remainingQty) <= 0 ? '' : 'badge badge-success'}>
                            {Number(b.remainingQty).toFixed(2)} Kg
                          </span>
                        </td>
                        <td>
                          {isExpired ? (
                            <span className="badge badge-danger">EXPIRED</span>
                          ) : Number(b.remainingQty) <= 0 ? (
                            <span className="badge badge-secondary">DEPLETED</span>
                          ) : (
                            <span className="badge badge-success">ACTIVE</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {batches.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                        {batchProdId ? 'No batches logged for this product.' : 'Please select a product above.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Loss & Damage Register Tab */}
        {currentTab === 'loss' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Dashboard KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
              <div className="card" style={{ padding: '1.25rem', borderRadius: '12px', backgroundColor: '#fff', borderLeft: '5px solid #ef4444' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Monthly Loss Value</span>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444', margin: '0.25rem 0 0 0' }}>
                  ₹{Number(lossDashboard.monthlyLossValue || 0).toFixed(2)}
                </h2>
              </div>
              <div className="card" style={{ padding: '1.25rem', borderRadius: '12px', backgroundColor: '#fff', borderLeft: '5px solid #ff9800' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Loss % of Sales Revenue</span>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ff9800', margin: '0.25rem 0 0 0' }}>
                  {Number(lossDashboard.lossPercentage || 0).toFixed(2)}%
                </h2>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
              {/* Form card */}
              <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', backgroundColor: '#fff' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Log Damaged Stock / Loss</h3>
                <form onSubmit={handleCreateLoss} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  <div className="form-group">
                    <label>Item Type</label>
                    <select className="form-control" value={lossItemType} onChange={(e) => setLossItemType(e.target.value)}>
                      <option value="finished_goods">Finished Good (Product)</option>
                      <option value="raw_material">Raw Material (Ingredients)</option>
                      <option value="packaging_material">Packaging / Pouches / Bottles</option>
                    </select>
                  </div>

                  {lossItemType === 'finished_goods' ? (
                    <div className="form-group">
                      <label>Select Product</label>
                      <select className="form-control" value={lossProdId} onChange={(e) => setLossProdId(e.target.value)}>
                        <option value="">-- Choose Product --</option>
                        {productsList.map(p => (
                          <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>Select Material</label>
                      <select className="form-control" value={lossRMId} onChange={(e) => setLossRMId(e.target.value)}>
                        <option value="">-- Choose Material --</option>
                        {rawMaterialsList
                          .filter(rm => {
                            if (lossItemType === 'packaging_material') {
                              return ['Packaging Materials', 'Pouches', 'Labels', 'Bottles', 'Cartons'].includes(rm.category);
                            } else {
                              return !['Packaging Materials', 'Pouches', 'Labels', 'Bottles', 'Cartons'].includes(rm.category);
                            }
                          })
                          .map(rm => (
                            <option key={rm.id} value={rm.id}>{rm.name} ({rm.category})</option>
                          ))
                        }
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Quantity to Deduct</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-control" 
                      value={lossQty} 
                      onChange={(e) => setLossQty(e.target.value)} 
                      placeholder="e.g. 15.50" 
                    />
                  </div>

                  <div className="form-group">
                    <label>Loss Reason</label>
                    <select className="form-control" value={lossReason} onChange={(e) => setLossReason(e.target.value)}>
                      <option value="Production Loss">Production Loss (Wastage)</option>
                      <option value="Packing Damage">Packing Damage (Burst Pouches)</option>
                      <option value="Expired">Expired Stock</option>
                      <option value="Returned Goods">Returned Goods (Damaged / Rejected)</option>
                      <option value="Manual Adjustment">Manual Audit Correction</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Internal Notes / Damage Report</label>
                    <textarea 
                      className="form-control" 
                      rows="2" 
                      value={lossNotes} 
                      onChange={(e) => setLossNotes(e.target.value)} 
                      placeholder="Explain how it was damaged..." 
                    />
                  </div>

                  <button type="submit" className="btn btn-danger" style={{ fontWeight: 700, padding: '0.6rem' }}>
                    🚨 Record Loss / Adjust Stock
                  </button>
                </form>
              </div>

              {/* Register table card */}
              <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', backgroundColor: '#fff' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Loss & Damage Log Register</h3>
                
                {loadingLosses ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>Loading log register...</div>
                ) : (
                  <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Item Description</th>
                          <th>Reason</th>
                          <th>Qty</th>
                          <th>Loss Value</th>
                          <th>Logged By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {losses.map(l => {
                          const name = l.itemType === 'finished_goods' ? l.product?.name : l.rawMaterial?.name;
                          const code = l.itemType === 'finished_goods' ? l.product?.sku : l.rawMaterial?.materialCode;
                          const unit = l.itemType === 'finished_goods' ? (l.product?.unit || 'pcs') : (l.rawMaterial?.unit || 'Kg');
                          
                          return (
                            <tr key={l.id}>
                              <td>{new Date(l.date).toLocaleDateString()}</td>
                              <td>
                                <div><strong>{name}</strong></div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Code: {code} | {l.itemType.replace('_', ' ').toUpperCase()}</div>
                              </td>
                              <td><span className="badge badge-warning" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>{l.reason}</span></td>
                              <td>{Number(l.quantity).toFixed(2)} {unit}</td>
                              <td><strong>₹{Number(l.totalLossValue).toFixed(2)}</strong></td>
                              <td>{l.createdBy?.name || 'Admin'}</td>
                            </tr>
                          );
                        })}
                        {losses.length === 0 && (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                              No stock loss logs registered.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
