const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const { initEventScheduler } = require('./utils/eventScheduler');

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(helmet({
  contentSecurityPolicy: false,           // Disable CSP — frontend uses inline scripts/styles
  crossOriginEmbedderPolicy: false,       // Allow loading external resources
  crossOriginResourcePolicy: false,       // Allow CDN resources (fonts, Chart.js, etc.)
}));

// Express 5.x makes req.query a getter. This middleware shadows the getter 
// with a writable property so that express-mongo-sanitize can assign to it.
app.use((req, res, next) => {
  Object.defineProperty(req, 'query', {
    value: req.query,
    configurable: true,
    writable: true
  });
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Security middleware that inspects req.body must be placed AFTER body parsers
app.use(mongoSanitize({ allowDots: true }));
app.use(hpp());

// Clean URLs middleware: Redirects trailing slashes and .html requests to clean paths, and serves static HTML
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  const urlPath = req.path;

  // 1. Strip trailing slashes (except for home page '/') to prevent relative path breakages
  if (urlPath !== '/' && urlPath.endsWith('/')) {
    const cleanUrl = urlPath.slice(0, -1) + (req.url.slice(urlPath.length) || '');
    return res.redirect(301, cleanUrl);
  }

  // 2. Redirect explicit .html requests to clean URLs
  if (urlPath.endsWith('.html')) {
    const cleanUrl = urlPath.slice(0, -5) + (req.url.slice(urlPath.length) || '');
    return res.redirect(301, cleanUrl);
  }

  // 3. Serve corresponding static html file if it exists in the public directory
  const fs = require('fs');
  const htmlFilePath = path.join(__dirname, 'public', urlPath + '.html');
  fs.stat(htmlFilePath, (err, stats) => {
    if (!err && stats.isFile()) {
      return res.sendFile(htmlFilePath);
    }
    next();
  });
});

app.use(express.static(path.join(__dirname, 'public')));

// EJS Setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('layout', 'layout'); // Tells it to use views/layout.ejs as the master layout
app.set('layout extractScripts', true); // Allows child pages to inject <script> tags at the bottom
app.set('layout extractStyles', true);  // Allows child pages to inject <style> or <link> tags in the <head>
app.set('views', path.join(__dirname, 'Views')); // Explicitly set views folder for Linux case-sensitivity

// Routes
app.use('/api/auth', require('./routes/Auth'));
// Default Home route
app.get('/', (req, res) => {
  res.render('index', { title: 'MCA Alumni Portal - Home' });
});

function sanitizeParam(param) {
  // Only allow alphanumeric, hyphens, and underscores
  return /^[a-zA-Z0-9_-]+$/.test(param);
}

// Generic routes to serve EJS pages without breaking your existing .html links!
app.get('/:page.html', (req, res, next) => {
  if (!sanitizeParam(req.params.page)) return next();
  res.render(req.params.page, (err, html) => {
    if (err) return next();
    res.send(html);
  });
});
app.get('/:role/:page.html', (req, res, next) => {
  if (!sanitizeParam(req.params.role) || !sanitizeParam(req.params.page)) return next();
  res.render(`${req.params.role}/${req.params.page}`, (err, html) => {
    if (err) return next();
    res.send(html);
  });
});
// Connect to MongoDB
const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL;
if (!mongoUri) {
  console.error('❌ MONGO_URI or MONGO_URL must be set in .env');
  process.exit(1);
}
// Using the main database. The Mongoose model will ensure it goes into an 'Admin' collection.
const mongoDbName = process.env.MONGO_DB_NAME || 'mca_alumni_portal';
mongoose.connect(mongoUri, { dbName: mongoDbName })
  .then(() => {
    console.log('MongoDB Connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      initEventScheduler();
    });
  })
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  });

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

// 404 Handler — must be after all other routes
app.use((req, res) => {
  res.status(404).send(`
    <div style="text-align:center; padding:50px; font-family:sans-serif;">
      <h1 style="font-size:72px; color:#1A56DB;">404</h1>
      <p style="font-size:20px; color:#6B7280;">Page Not Found</p>
      <a href="/" style="color:#1A56DB;">Go to Home Page</a>
    </div>
  `);
});

// Global Error Handler — must be the very last middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).send(`
    <div style="text-align:center; padding:50px; font-family:sans-serif;">
      <h1 style="font-size:72px; color:#DC2626;">500</h1>
      <p style="font-size:20px; color:#6B7280;">Internal Server Error</p>
      <a href="/" style="color:#1A56DB;">Go to Home Page</a>
    </div>
  `);
});