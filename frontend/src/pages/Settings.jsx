import { useState, useEffect } from 'react';
import { settingsApi } from '../api';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

export default function SettingsPage() {
  const { settings, updateSettings, loadSettings } = useSettings();
  const { darkMode, setDarkMode } = useTheme();
  const { toast } = useToast();
  const [form, setForm] = useState({});
  const [logo, setLogo] = useState(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const save = async () => {
    try {
      await updateSettings(form);
      toast('Settings saved', 'success');
    } catch {
      toast('Save failed', 'error');
    }
  };

  const uploadLogo = async () => {
    if (!logo) return;
    const fd = new FormData();
    fd.append('logo', logo);
    try {
      await settingsApi.uploadLogo(fd);
      await loadSettings();
      toast('Logo uploaded', 'success');
    } catch {
      toast('Upload failed', 'error');
    }
  };

  if (!settings) return null;

  return (
    <div className="page">
      <div className="page-header"><h1 className="page-title">Settings</h1></div>
      <div className="card" style={{ maxWidth: 640 }}>
        {['companyName', 'address', 'phone', 'gstDetails', 'invoicePrefix', 'financialYear'].map((f) => (
          <div key={f} className="form-group">
            <label>{f}</label>
            <input className="form-control" value={form[f] || ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
          </div>
        ))}
        <div className="form-group">
          <label>Brand Color</label>
          <input type="color" value={form.brandColor || '#2563eb'} onChange={(e) => setForm({ ...form, brandColor: e.target.value })} />
        </div>
        <div className="form-group">
          <label><input type="checkbox" checked={form.defaultDarkMode} onChange={(e) => setForm({ ...form, defaultDarkMode: e.target.checked })} /> Default Dark Mode</label>
        </div>
        <div className="form-group">
          <label>Dark Mode (current session)</label>
          <button type="button" className="btn btn-secondary" onClick={() => setDarkMode(!darkMode)}>Toggle ({darkMode ? 'On' : 'Off'})</button>
        </div>
        <div className="form-group">
          <label>Logo</label>
          <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files[0])} />
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }} onClick={uploadLogo}>Upload Logo</button>
        </div>
        <button type="button" className="btn btn-primary" onClick={save}>Save Settings</button>
      </div>
    </div>
  );
}
