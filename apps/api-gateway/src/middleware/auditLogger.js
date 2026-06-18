const AuditLog = require('../models/AuditLog');

// Simple PII masking for emails and phone numbers
const maskPii = (data) => {
  if (!data) return data;
  let str = typeof data === 'string' ? data : JSON.stringify(data);
  
  // Mask emails
  str = str.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***');
  
  // Mask generic phone numbers (simplified)
  str = str.replace(/\+?\d{1,3}?[-.\s]?\(?\d{1,4}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, '[PHONE-REDACTED]');
  
  return typeof data === 'string' ? str : JSON.parse(str);
};

const createAuditLog = async (req, action, resource, resourceId = null, before = null, after = null) => {
  try {
    await AuditLog.create({
      userId: req.user ? req.user._id : null,
      teamId: req.user ? req.user.teamId : null,
      action,
      resource,
      resourceId,
      before: maskPii(before),
      after: maskPii(after),
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
};

// Express middleware generator for tracking changes
const auditLogger = (resource) => {
  return async (req, res, next) => {
    // We want to capture the request body for updates/creates
    // and ideally the response as the "after" state
    
    const originalSend = res.send;
    
    res.send = function (body) {
      res.send = originalSend;
      
      let action = 'read';
      if (req.method === 'POST') action = 'create';
      else if (req.method === 'PUT' || req.method === 'PATCH') action = 'update';
      else if (req.method === 'DELETE') action = 'delete';
      
      if (action !== 'read' && res.statusCode >= 200 && res.statusCode < 300) {
        let afterState = null;
        try {
          afterState = JSON.parse(body);
        } catch(e) {
          afterState = body;
        }
        
        createAuditLog(
          req, 
          action, 
          resource, 
          req.params.id || (afterState && afterState.data ? afterState.data._id : null),
          req.method !== 'POST' ? req.body : null, // Usually want actual 'before' from DB, but this is simplified
          afterState
        );
      }
      
      return res.send(body);
    };
    
    next();
  };
};

module.exports = { createAuditLog, auditLogger, maskPii };
