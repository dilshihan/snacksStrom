const multer = require('multer');
const path = require('path');
const fs = require('fs');

const getUploadDir = (subDir = '') => {
    const baseDir = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, '../uploads');
    const targetDir = path.join(baseDir, subDir);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    return targetDir;
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, getUploadDir());
    }, 
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); 
    }
});

const upload = multer({ 
    storage, 
    limits: { 
        fileSize: 100 * 1024 * 1024, // 100MB file limit
        fieldSize: 100 * 1024 * 1024 // 100MB max for text fields
    },
}).array('image', 3);


const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, getUploadDir('profile_pictures'));
    },
    filename: (req, file, cb) => {
        cb(null, 'profile_' + Date.now() + path.extname(file.originalname)); // Unique filename
    }
});

// File filter for images only
const profileFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Multer instance for profile pictures (Single file upload)
const uploadProfilePicture = multer({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit to 5MB
    fileFilter: profileFileFilter
}).single('profilePicture');


module.exports = { upload, uploadProfilePicture };

