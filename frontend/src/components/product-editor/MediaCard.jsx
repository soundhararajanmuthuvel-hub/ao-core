import React from 'react';
import { Cloud, Upload, RefreshCw, AlertTriangle, RotateCcw, X } from 'lucide-react';
import ErrorBoundary from '../ErrorBoundary';
import { resolveAssetUrl } from '../../utils/url';

export default function MediaCard({
  formData = {},
  setFormData = () => {},
  setIsDirty = () => {},
  uploadingToCloudinary = false,
  uploadProgress = 0,
  uploadErrorMsg = '',
  customImageUrl = '',
  setCustomImageUrl = () => {},
  handleCloudinaryFileUpload = () => {},
  handleRetryUpload = () => {},
  optimisticPreviews = [],
}) {
  return (
    <ErrorBoundary>
      <div style={{ marginBottom: '1.5rem', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem', background: '#FAFAFA' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Cloud size={16} color="#0284C7" /> Cloudinary Media Library
          </h4>
        </div>

        {/* UPLOAD PROGRESS BAR */}
        {uploadingToCloudinary && (
          <div style={{ marginBottom: '1rem', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '8px', padding: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#0284C7', marginBottom: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <RefreshCw size={12} className="spin" /> Uploading to Cloudinary...
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: '#E0F2FE', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#0284C7', transition: 'width 0.2s ease' }} />
            </div>
          </div>
        )}

        {/* INLINE ERROR WITH RETRY BUTTON */}
        {uploadErrorMsg && !uploadingToCloudinary && (
          <div style={{ marginBottom: '1rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#991B1B', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={14} /> Cloudinary Upload Failed
            </div>
            <div style={{ fontSize: '0.75rem', color: '#7F1D1D', marginBottom: '0.6rem', lineHeight: '1.4' }}>
              {uploadErrorMsg}
            </div>
            <button
              type="button"
              onClick={handleRetryUpload}
              style={{ background: '#DC2626', color: '#FFF', border: 'none', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <RotateCcw size={12} /> Retry Upload
            </button>
          </div>
        )}

        {/* DIRECT UPLOAD BUTTON & URL INPUT */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1rem',
              border: '1px dashed #0284C7',
              borderRadius: '8px',
              background: '#F0F9FF',
              cursor: uploadingToCloudinary ? 'not-allowed' : 'pointer',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#0284C7',
            }}
          >
            <Upload size={16} />
            {uploadingToCloudinary ? `Uploading (${uploadProgress}%)...` : 'Upload to Cloudinary'}
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/jpg"
              disabled={uploadingToCloudinary}
              onChange={handleCloudinaryFileUpload}
              style={{ display: 'none' }}
            />
          </label>

          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
            <input
              type="url"
              placeholder="Or paste direct image URL..."
              value={customImageUrl || ''}
              onChange={(e) => setCustomImageUrl(e.target.value)}
              style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.78rem' }}
            />
            <button
              type="button"
              onClick={() => {
                if (!customImageUrl?.trim()) return;
                setFormData((prev) => ({ ...prev, images: [...(prev.images || []), customImageUrl.trim()] }));
                setCustomImageUrl('');
                setIsDirty(true);
              }}
              style={{ background: '#0284C7', color: '#FFF', border: 'none', borderRadius: '6px', padding: '0.4rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Add URL
            </button>
          </div>
        </div>

        {/* OPTIMISTIC PREVIEW THUMBNAILS */}
        {optimisticPreviews.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {optimisticPreviews.map((url, idx) => (
              <div key={idx} style={{ position: 'relative', border: '1px dashed #0284C7', borderRadius: '6px', overflow: 'hidden', height: '80px', opacity: 0.7 }}>
                <img src={url} alt="Uploading..." style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={{ position: 'absolute', inset: 0, background: 'rgba(2, 132, 199, 0.4)', color: '#FFF', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {uploadProgress}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* GALLERY GRID */}
        {formData.images && formData.images.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {formData.images.map((imgUrl, idx) => (
              <div key={idx} style={{ position: 'relative', border: idx === 0 ? '2px solid #0284C7' : '1px solid #E2E8F0', borderRadius: '6px', overflow: 'hidden', height: '80px' }}>
                <img src={resolveAssetUrl(imgUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {idx === 0 && (
                  <span style={{ position: 'absolute', top: 2, left: 2, background: '#0284C7', color: '#FFF', fontSize: '0.6rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px' }}>
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }))}
                  style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#FFF', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: '#94A3B8', textAlign: 'center', padding: '1rem', border: '1px dashed #CBD5E1', borderRadius: '8px' }}>
            No images added yet. Upload to Cloudinary or paste a direct image URL above.
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
