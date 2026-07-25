import React, { useState } from 'react';
import { Cloud, Upload, RefreshCw, AlertTriangle, RotateCcw, X, ArrowLeft, ArrowRight, Star, Clipboard } from 'lucide-react';
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
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Validate files: JPG, JPEG, PNG, WEBP, AVIF <= 10MB
  const validateFiles = (files) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];
    const maxBytes = 10 * 1024 * 1024; // 10MB
    setValidationError('');

    for (let f of files) {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      const validExt = ['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(ext);
      if (!allowedTypes.includes(f.type) && !validExt) {
        setValidationError(`Unsupported file format (${f.name}). Allowed: JPG, PNG, WEBP, AVIF.`);
        return false;
      }
      if (f.size > maxBytes) {
        setValidationError(`Image size exceeds 10MB limit (${(f.size / (1024 * 1024)).toFixed(1)}MB).`);
        return false;
      }
    }
    return true;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (uploadingToCloudinary) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && validateFiles(files)) {
      handleCloudinaryFileUpload({ target: { files } });
    }
  };

  const handlePaste = (e) => {
    if (uploadingToCloudinary) return;
    const clipboardItems = e.clipboardData?.items;
    if (clipboardItems) {
      const imageFiles = [];
      for (let item of clipboardItems) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0 && validateFiles(imageFiles)) {
        handleCloudinaryFileUpload({ target: { files: imageFiles } });
        return;
      }
    }

    const pastedText = e.clipboardData?.getData('text');
    if (pastedText && (pastedText.startsWith('http://') || pastedText.startsWith('https://') || pastedText.startsWith('data:image/'))) {
      setCustomImageUrl(pastedText);
    }
  };

  // Reorder images
  const moveImage = (index, direction) => {
    const images = [...(formData.images || [])];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= images.length) return;
    const temp = images[index];
    images[index] = images[targetIdx];
    images[targetIdx] = temp;
    setFormData((prev) => ({ ...prev, images }));
    setIsDirty(true);
  };

  // Set cover (primary) image
  const setCoverImage = (index) => {
    if (index === 0) return;
    const images = [...(formData.images || [])];
    const [selected] = images.splice(index, 1);
    images.unshift(selected);
    setFormData((prev) => ({ ...prev, images }));
    setIsDirty(true);
  };

  // Local Blob Preview Fallback (Step 9)
  const addLocalPreviewFallback = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (!validateFiles(files)) return;

    const localUrls = files.map((f) => URL.createObjectURL(f));
    setFormData((prev) => ({ ...prev, images: [...(prev.images || []), ...localUrls] }));
    setIsDirty(true);
  };

  return (
    <ErrorBoundary>
      <div
        onPaste={handlePaste}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        style={{
          marginBottom: '1.5rem',
          border: isDragging ? '2px dashed #0284C7' : '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '1rem',
          background: isDragging ? '#F0F9FF' : '#FAFAFA',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Cloud size={16} color="#0284C7" /> Storefront Media Library
          </h4>
          <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <Clipboard size={12} /> Drag, Drop or Paste Images
          </span>
        </div>

        {/* VALIDATION ERROR BANNER */}
        {validationError && (
          <div style={{ marginBottom: '0.75rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: '#991B1B', fontWeight: 600 }}>
            {validationError}
          </div>
        )}

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

        {/* INLINE ERROR WITH RETRY & LOCAL PREVIEW FALLBACK */}
        {uploadErrorMsg && !uploadingToCloudinary && (
          <div style={{ marginBottom: '1rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#991B1B', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={14} /> Upload Warning
            </div>
            <div style={{ fontSize: '0.75rem', color: '#7F1D1D', marginBottom: '0.6rem', lineHeight: '1.4' }}>
              {uploadErrorMsg}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleRetryUpload}
                style={{ background: '#DC2626', color: '#FFF', border: 'none', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <RotateCcw size={12} /> Retry Upload
              </button>
              <label
                style={{ background: '#0284C7', color: '#FFF', border: 'none', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                Use Local Preview
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/jpg,image/avif" onChange={addLocalPreviewFallback} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        )}

        {/* DROP ZONE & UPLOAD BUTTON */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
              padding: '1rem',
              border: '2px dashed #0284C7',
              borderRadius: '8px',
              background: '#F0F9FF',
              cursor: uploadingToCloudinary ? 'not-allowed' : 'pointer',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: '#0284C7',
              textAlign: 'center',
            }}
          >
            <Upload size={20} />
            <span>{uploadingToCloudinary ? `Uploading (${uploadProgress}%)...` : 'Drag & drop images, or click to browse'}</span>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 500 }}>Supports JPG, JPEG, PNG, WEBP, AVIF up to 10MB</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/jpg,image/avif"
              disabled={uploadingToCloudinary}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0 && validateFiles(files)) {
                  handleCloudinaryFileUpload(e);
                }
              }}
              style={{ display: 'none' }}
            />
          </label>

          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
            <input
              type="url"
              placeholder="Or paste image URL (https://... or data:image/...)"
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
              <div key={idx} style={{ position: 'relative', border: '1px dashed #0284C7', borderRadius: '6px', overflow: 'hidden', height: '85px', opacity: 0.7 }}>
                <img src={url} alt="Uploading..." style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={{ position: 'absolute', inset: 0, background: 'rgba(2, 132, 199, 0.4)', color: '#FFF', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {uploadProgress}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* GALLERY GRID WITH REORDER & COVER ACTIONS */}
        {formData.images && formData.images.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {formData.images.map((imgUrl, idx) => (
              <div key={idx} style={{ position: 'relative', border: idx === 0 ? '2px solid #0284C7' : '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden', height: '95px', background: '#000' }}>
                <img src={resolveAssetUrl(imgUrl)} alt={`Product ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                
                {/* COVER BADGE OR SET COVER BUTTON */}
                {idx === 0 ? (
                  <span style={{ position: 'absolute', top: 3, left: 3, background: '#0284C7', color: '#FFF', fontSize: '0.6rem', fontWeight: 800, padding: '2px 5px', borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <Star size={10} fill="#FFF" /> Cover
                  </span>
                ) : (
                  <button
                    type="button"
                    title="Set as Cover Image"
                    onClick={() => setCoverImage(idx)}
                    style={{ position: 'absolute', top: 3, left: 3, background: 'rgba(0,0,0,0.6)', color: '#FFF', border: 'none', borderRadius: '3px', padding: '2px 4px', fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    <Star size={10} /> Set Cover
                  </button>
                )}

                {/* DELETE BUTTON */}
                <button
                  type="button"
                  title="Remove Image"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
                    setIsDirty(true);
                  }}
                  style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(220, 38, 38, 0.85)', color: '#FFF', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={12} />
                </button>

                {/* REORDER BUTTONS (MOVE LEFT / MOVE RIGHT) */}
                <div style={{ position: 'absolute', bottom: 3, right: 3, display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', padding: '1px' }}>
                  {idx > 0 && (
                    <button
                      type="button"
                      title="Move Left"
                      onClick={() => moveImage(idx, -1)}
                      style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                    >
                      <ArrowLeft size={12} />
                    </button>
                  )}
                  {idx < formData.images.length - 1 && (
                    <button
                      type="button"
                      title="Move Right"
                      onClick={() => moveImage(idx, 1)}
                      style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                    >
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: '#94A3B8', textAlign: 'center', padding: '1.2rem', border: '1px dashed #CBD5E1', borderRadius: '8px' }}>
            No images added yet. Drag & drop files, upload to Cloudinary, or paste a URL above.
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

