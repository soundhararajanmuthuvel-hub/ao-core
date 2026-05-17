export default function LoadingSpinner({ full }) {
  return (
    <div className={`loading-spinner ${full ? 'full' : ''}`}>
      <div className="spinner" />
    </div>
  );
}
