const WebsiteEvent = require('../models/WebsiteEvent');

// POST /api/website/events
const logEvent = async (req, res) => {
  try {
    const { eventType, sessionKey, eventData } = req.body;
    const customerId = req.websiteCustomer?.id || req.body.customerId || null;

    if (!eventType) {
      return res.status(400).json({ success: false, message: 'Event type is required.' });
    }

    const newEvent = await WebsiteEvent.create({
      eventType,
      customerId,
      sessionKey: sessionKey || null,
      eventData: typeof eventData === 'object' ? JSON.stringify(eventData) : eventData || '',
    });

    res.status(201).json({ success: true, eventId: newEvent.id });
  } catch (err) {
    console.error('Error logging website event:', err);
    res.status(500).json({ success: false, message: 'Failed to log website event' });
  }
};

module.exports = { logEvent };
