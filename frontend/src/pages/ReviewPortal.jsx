import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { sfaApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const primaryColor = '#5a2d0c';

export default function ReviewPortal() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [reviewData, setReviewData] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  
  // Rating states
  const [productRating, setProductRating] = useState(5);
  const [deliveryRating, setDeliveryRating] = useState(5);
  const [salesmanRating, setSalesmanRating] = useState(5);
  const [overallRating, setOverallRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  useEffect(() => {
    const fetchReviewDetails = async () => {
      try {
        const res = await sfaApi.getReviewDetails(token);
        setReviewData(res.data);
        if (res.data.status === 'Submitted') {
          setSubmitted(true);
        }
      } catch (err) {
        console.error('Error fetching review token details:', err);
      } finally {
        setLoading(false);
      }
    };
    if (token) {
      fetchReviewDetails();
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await sfaApi.submitReview(token, {
        productRating,
        deliveryRating,
        salesmanRating,
        overallRating,
        reviewText
      });
      setSubmitted(true);
      alert('Feedback submitted successfully! Thank you for rating our service. 🌟');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit review.');
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!reviewData) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f8fafc', padding: '1rem', fontFamily: 'Inter, sans-serif' }}>
        <div className="card" style={{ padding: '2rem', maxWidth: '400px', textAlign: 'center', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '3rem' }}>⚠️</span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '1rem 0 0.5rem 0' }}>Invalid or Expired Link</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>This WhatsApp feedback reference code is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const StarSelector = ({ rating, setRating }) => {
    return (
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {[1, 2, 3, 4, 5].map(star => (
          <span
            key={star}
            onClick={() => setRating(star)}
            style={{
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: star <= rating ? '#fbbf24' : '#e2e8f0',
              transition: 'color 0.15s ease'
            }}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '2rem', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
        
        {/* Branding header */}
        <div style={{ textAlign: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: primaryColor, margin: 0 }}>AMUDHASURABIY ORGANICS</h1>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0 0', textTransform: 'uppercase', letterSpacing: '2px' }}>Customer Feedback Portal</p>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <span style={{ fontSize: '4rem' }}>🎉</span>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '1rem 0 0.5rem 0', color: '#0f172a' }}>Thank You for Your Feedback!</h2>
            <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Your ratings and reviews have been submitted successfully to our distributor dashboard. We appreciate your partnership.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Verify Order details</h3>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>Customer Name: <strong>{reviewData.customer?.name}</strong></div>
                <div>Invoice Code: <strong>{reviewData.invoice?.invoiceNumber}</strong></div>
                <div>Invoice Date: <strong>{new Date(reviewData.invoice?.date).toLocaleDateString()}</strong></div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Product Quality:</span>
                <StarSelector rating={productRating} setRating={setProductRating} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Delivery Experience:</span>
                <StarSelector rating={deliveryRating} setRating={setDeliveryRating} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Salesman Behavior:</span>
                <StarSelector rating={salesmanRating} setRating={setSalesmanRating} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Overall Experience:</span>
                <StarSelector rating={overallRating} setRating={setOverallRating} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Share Comments or Feedback</label>
              <textarea
                rows="4"
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                placeholder="Write down any additional comments about the service, delivery staff, or product quality..."
                className="form-control"
                style={{ width: '100%', resize: 'none' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', backgroundColor: primaryColor, borderColor: primaryColor, fontWeight: 700, padding: '0.75rem' }}
            >
              Submit Feedback
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
