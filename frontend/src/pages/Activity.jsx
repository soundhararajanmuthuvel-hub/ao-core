import { useEffect, useState } from 'react';
import { activityApi } from '../api';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Activity() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    activityApi.list({ page, limit: 20 }).then(({ data }) => {
      setLogs(data.logs);
      setPages(data.pages);
    }).finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="page">
      <div className="page-header"><h1 className="page-title">Activity Logs</h1></div>
      {loading ? <LoadingSpinner /> : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead><tr><th>User</th><th>Action</th><th>Module</th><th>Details</th><th>Time</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td>{l.user?.name || '—'}</td>
                  <td>{l.action}</td>
                  <td>{l.module}</td>
                  <td>{l.details}</td>
                  <td>{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} pages={pages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
