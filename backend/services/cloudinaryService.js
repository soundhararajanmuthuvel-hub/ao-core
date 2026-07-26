const cloudinary = require('cloudinary').v2;

/**
 * Helper to mask sensitive strings for safe logging
 * @param {String} str 
 * @returns {String}
 */
function maskSecret(str) {
  if (!str || typeof str !== 'string') return 'Missing';
  if (str.length <= 6) return '******';
  return `${str.substring(0, 4)}******${str.substring(str.length - 4)}`;
}

// 1. Resolve Cloudinary environment credentials — priority order:
// Priority 1: Individual env variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
// Priority 2: CLOUDINARY_URL string fallback (used only if individual env vars are missing)
// No hardcoded fallback — missing credentials throw at startup to prevent silent misconfiguration.
let configMethod = 'INDIVIDUAL_ENV_VARS';
let cloudName = process.env.CLOUDINARY_CLOUD_NAME;
let apiKey = process.env.CLOUDINARY_API_KEY;
let apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  configMethod = 'INDIVIDUAL_ENV_VARS';
} else if (process.env.CLOUDINARY_URL) {
  const match = process.env.CLOUDINARY_URL.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (match) {
    configMethod = 'CLOUDINARY_URL';
    apiKey = match[1].trim();
    apiSecret = match[2].trim();
    cloudName = match[3].trim();
  }
} else {
  // Never fall back to hardcoded credentials.
  // If env vars are not set, fail loudly at startup rather than silently
  // using real credentials embedded in source code.
  console.error('\n======================================================');
  console.error('CRITICAL STARTUP FAILURE');
  console.error('======================================================');
  console.error('[Cloudinary] Missing required environment variables:');
  console.error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.');
  console.error('Set these in your .env file or CLOUDINARY_URL in your deployment dashboard.');
  console.error('======================================================\n');
  process.exit(1);
}

// 2. Initialize Cloudinary SDK exactly once on startup
cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

console.log('[Cloudinary SDK Initialized]');
console.log(`- Config Method: ${configMethod}`);
console.log(`- Cloud Name:    ${cloudName}`);
console.log(`- API Key:       ${maskSecret(apiKey)}`);
console.log(`- API Secret:    ${maskSecret(apiSecret)}`);



/**
 * Categorizes raw Cloudinary errors into clean, structured errors
 */
function categorizeCloudinaryError(error) {
  const httpStatus = error.http_code || error.status || 500;
  const rawMessage = error.message || 'Unknown Cloudinary error';

  let errorType = 'CLOUDINARY_UPLOAD_ERROR';
  let formattedMessage = rawMessage;
  let suggestion = 'Please check Cloudinary API status and configuration.';

  if (httpStatus === 401 || rawMessage.includes('Invalid api_key') || rawMessage.includes('unknown api_key')) {
    errorType = 'CLOUDINARY_AUTH_ERROR';
    formattedMessage = `Cloudinary API Authentication Failed (HTTP 401). API Key: ${maskSecret(apiKey)}.`;
    suggestion = 'Verify that the API Key and Secret match your active Cloudinary Product Environment under Settings -> API Keys.';
  } else if (httpStatus === 400 || rawMessage.includes('format') || rawMessage.includes('file')) {
    errorType = 'CLOUDINARY_INVALID_FILE';
    formattedMessage = `Invalid image file or upload parameters: ${rawMessage}`;
    suggestion = 'Ensure you are uploading a supported image format (JPG, PNG, WEBP) under 10MB.';
  } else if (httpStatus === 429 || httpStatus === 420) {
    errorType = 'CLOUDINARY_RATE_LIMIT';
    formattedMessage = 'Cloudinary API Rate Limit Exceeded';
    suggestion = 'Too many upload requests. Please wait a few moments before retrying.';
  } else if (rawMessage.includes('ENOTFOUND') || rawMessage.includes('ETIMEDOUT') || rawMessage.includes('ECONNREFUSED')) {
    errorType = 'CLOUDINARY_NETWORK_ERROR';
    formattedMessage = 'Network connection to Cloudinary API failed.';
    suggestion = 'Verify server outbound internet access and Cloudinary CDN status.';
  }

  const err = new Error(formattedMessage);
  err.httpStatus = httpStatus;
  err.type = errorType;
  err.rawMessage = rawMessage;
  err.suggestion = suggestion;
  return err;
}

/**
 * Upload an image buffer or file path/Data URI to Cloudinary
 * @param {Buffer|String} fileBufferOrPath 
 * @param {Object} customOptions 
 * @returns {Promise<{ secure_url: string, public_id: string, url: string }>}
 */
const uploadImage = async (fileBufferOrPath, customOptions = {}) => {
  const options = {
    folder: 'ao_core/products',
    resource_type: 'auto',
    ...customOptions,
  };

  console.log(`[Cloudinary Uploading] Folder: ${options.folder}, Cloud Name: ${cloudName}`);


  return new Promise((resolve, reject) => {
    const handleUploadResult = (error, result) => {
      if (error) {
        console.error('[Cloudinary Upload Failed]', error);
        return reject(categorizeCloudinaryError(error));
      }
      console.log(`[Cloudinary Upload Success] Public ID: ${result.public_id}, URL: ${result.secure_url}`);
      resolve({
        secure_url: result.secure_url,
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      });
    };

    if (Buffer.isBuffer(fileBufferOrPath)) {
      const uploadStream = cloudinary.uploader.upload_stream(options, handleUploadResult);
      uploadStream.end(fileBufferOrPath);
    } else if (typeof fileBufferOrPath === 'string') {
      cloudinary.uploader.upload(fileBufferOrPath, options, handleUploadResult);
    } else {
      reject(new Error('Invalid file input for Cloudinary upload. Must be Buffer or String path/DataURI.'));
    }
  });
};

/**
 * Delete an image from Cloudinary by publicId
 * @param {String} publicId 
 */
const deleteImage = async (publicId) => {
  if (!publicId) return { result: 'not_found' };
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`[Cloudinary Delete Success] Public ID: ${publicId}, Result: ${result.result}`);
    return result;
  } catch (error) {
    console.error(`[Cloudinary Delete Failed] Public ID: ${publicId}`, error);
    throw categorizeCloudinaryError(error);
  }
};

/**
 * Replace an old Cloudinary image with a new one
 */
const updateImage = async (newFileBufferOrPath, oldPublicId = null) => {
  if (oldPublicId) {
    try {
      await deleteImage(oldPublicId);
    } catch (err) {
      console.warn(`[Cloudinary Update] Warning deleting old asset (${oldPublicId}):`, err.message);
    }
  }
  return await uploadImage(newFileBufferOrPath);
};

/**
 * Extract publicId from a Cloudinary URL string
 */
const extractPublicId = (url) => {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) {
    return null;
  }
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const pathAfterUpload = parts[1];
    const cleanPath = pathAfterUpload.replace(/^v\d+\//, '');
    return cleanPath.replace(/\.[^/.]+$/, '');
  } catch (e) {
    return null;
  }
};

/**
 * Cloudinary Health Diagnostic Check
 * Performs in-memory upload test and deletes test asset immediately
 */
const checkHealth = async () => {
  const startTime = Date.now();
  // Valid sample image URL for diagnostic upload test
  const sampleUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

  try {
    console.log('[Cloudinary Health] Running diagnostic upload test...');
    const uploadRes = await uploadImage(sampleUrl, {
      folder: 'ao_core/health_check',
      tags: ['health_check'],
    });




    const latencyMs = Date.now() - startTime;
    console.log(`[Cloudinary Health] Upload test passed (${latencyMs}ms). Public ID: ${uploadRes.public_id}`);

    // Immediate cleanup of health check asset
    if (uploadRes.public_id) {
      try {
        await deleteImage(uploadRes.public_id);
        console.log(`[Cloudinary Health] Diagnostic test asset deleted: ${uploadRes.public_id}`);
      } catch (cleanupErr) {
        console.warn(`[Cloudinary Health] Cleanup warning:`, cleanupErr.message);
      }
    }

    return {
      connected: true,
      configurationLoaded: true,
      configMethod,
      cloudName,
      maskedApiKey: maskSecret(apiKey),
      maskedApiSecret: maskSecret(apiSecret),
      sdkVersion: '2.10.0',
      connectionStatus: 'Connected',
      authenticationSuccess: true,
      uploadTestResult: {
        secure_url: uploadRes.secure_url,
        public_id: uploadRes.public_id,
        latencyMs: `${latencyMs}ms`,
      },
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    console.error('[Cloudinary Health Diagnostic Failed]', err);
    const connStatus = err.httpStatus === 401 ? 'Authentication Failed' : 'Error';
    return {
      connected: false,
      configurationLoaded: true,
      configMethod,
      cloudName,
      maskedApiKey: maskSecret(apiKey),
      maskedApiSecret: maskSecret(apiSecret),
      sdkVersion: '2.10.0',
      connectionStatus: connStatus,
      authenticationSuccess: false,
      uploadTestResult: null,
      errorCode: err.type || 'CLOUDINARY_AUTH_FAILED',
      errorMessage: err.message || 'Cloudinary health check failed',
      error: {
        type: err.type || 'CLOUDINARY_HEALTH_FAILED',
        httpStatus: err.httpStatus || 500,
        message: err.message,
        suggestion: err.suggestion || 'Check Cloudinary credentials in Cloudinary Settings.',
      },
    };
  }
};


module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
  updateImage,
  extractPublicId,
  checkHealth,
  maskSecret,
};
