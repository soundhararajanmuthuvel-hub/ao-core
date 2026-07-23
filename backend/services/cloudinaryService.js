const cloudinary = require('cloudinary').v2;

// Dynamically resolve Cloudinary environment credentials
let cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dacgzzpi';
let apiKey = process.env.CLOUDINARY_API_KEY || '248258869444973';
let apiSecret = process.env.CLOUDINARY_API_SECRET || 'b7if9RfwcV4XV3DJEH7Sry-rF-g';

if (process.env.CLOUDINARY_URL) {
  const match = process.env.CLOUDINARY_URL.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (match) {
    apiKey = match[1].trim();
    apiSecret = match[2].trim();
    cloudName = match[3].trim();
  }
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

/**
 * Upload an image buffer or file path to Cloudinary
 * @param {Buffer|String} fileBufferOrPath - Image Buffer or File Path / Data URI
 * @param {Object} customOptions - Optional custom Cloudinary upload options
 * @returns {Promise<{ secure_url: string, public_id: string, url: string }>}
 */
const uploadImage = async (fileBufferOrPath, customOptions = {}) => {
  const options = {
    folder: 'ao_core/products',
    resource_type: 'image',
    fetch_format: 'auto',
    quality: 'auto',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    ...customOptions,
  };

  return new Promise((resolve, reject) => {
    const handleUploadResult = (error, result) => {
      if (error) {
        console.error('[Cloudinary Upload Error]', error);
        let errorMsg = error.message || 'Unknown upload error';
        if (errorMsg.includes('Invalid api_key') || errorMsg.includes('unknown api_key')) {
          errorMsg = `Cloudinary API Key "${apiKey}" is invalid or revoked. Please verify the active API Key in Cloudinary Settings.`;
        }
        return reject(new Error(errorMsg));
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
 * @param {String} publicId - Cloudinary asset public ID
 * @returns {Promise<{ result: string }>}
 */
const deleteImage = async (publicId) => {
  if (!publicId) return { result: 'not_found' };
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`[Cloudinary Delete Success] Public ID: ${publicId}, Result: ${result.result}`);
    return result;
  } catch (error) {
    console.error(`[Cloudinary Delete Error] Public ID: ${publicId}`, error);
    throw new Error(`Cloudinary delete failed: ${error.message}`);
  }
};

/**
 * Replace an old Cloudinary image with a new one
 * @param {Buffer|String} newFileBufferOrPath - New image Buffer or String
 * @param {String} oldPublicId - Existing Cloudinary public ID to delete
 * @returns {Promise<{ secure_url: string, public_id: string, url: string }>}
 */
const updateImage = async (newFileBufferOrPath, oldPublicId = null) => {
  if (oldPublicId) {
    try {
      await deleteImage(oldPublicId);
    } catch (err) {
      console.warn(`[Cloudinary Update] Failed to remove previous image (${oldPublicId}):`, err.message);
    }
  }
  return await uploadImage(newFileBufferOrPath);
};

/**
 * Extract publicId from a Cloudinary URL string
 * @param {String} url - Cloudinary image URL
 * @returns {String|null}
 */
const extractPublicId = (url) => {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) {
    return null;
  }
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const pathAfterUpload = parts[1];
    // Remove version string (e.g. v1723456789/) if present
    const cleanPath = pathAfterUpload.replace(/^v\d+\//, '');
    // Strip file extension (.jpg, .png, .webp)
    return cleanPath.replace(/\.[^/.]+$/, '');
  } catch (e) {
    return null;
  }
};

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
  updateImage,
  extractPublicId,
};
