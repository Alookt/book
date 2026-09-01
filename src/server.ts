import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock Data Store
interface User {
  id: number;
  username: string;
  email: string;
  password?: string;
  role: 'author' | 'admin' | 'user';
}

interface Book {
  id: number;
  title: string;
  author: string;
  description: string;
}

interface Recommendation {
  id: number;
  title: string;
  author: string;
  text: string;
  authorId: number;
  threeDObject?: string;
  views: number;
}

interface PendingText {
  id: number;
  author: string;
  authorId: number;
  text: string;
  format: string;
  threeDObject?: string;
  status: string;
  timestamp: string;
}

interface Database {
  users: User[];
  books: Book[];
  recommendations: Recommendation[];
  pendingTexts: PendingText[];
}

const db: Database = {
  users: [],
  books: [
    { id: 1, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', description: 'A story of wealth, love, and the American Dream.' },
    { id: 2, title: '1984', author: 'George Orwell', description: 'A dystopian society under constant surveillance.' },
    { id: 3, title: 'Brave New World', author: 'Aldous Huxley', description: 'A futuristic world of genetically modified humans.' },
  ],
  recommendations: [
    { id: 1, title: 'Recommended Read: The Art of War', author: 'Sun Tzu', text: 'Explore the strategies of ancient warfare.', authorId: 99, views: 0 },
    { id: 2, title: 'Must Read: Meditations', author: 'Marcus Aurelius', text: 'Stoic philosophy for a better life.', authorId: 100, views: 0 },
  ],
  pendingTexts: []
};

// API Endpoints
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;

  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ message: 'Username already taken.' });
  }

  const newUser: User = {
    id: db.users.length + 1,
    username,
    email,
    password,
    role: 'author'
  };

  db.users.push(newUser);
  console.log(`Registering author: ${username}`);
  return res.status(201).json({
    token: 'mock-token-123',
    user: { id: newUser.id, username, email, first_name: 'Author', last_name: 'Name', role: newUser.role }
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  console.log(`Logging in author: ${username}`);
  return res.json({
    token: 'mock-token-123',
    user: { id: user.id, username: user.username, email: user.email, first_name: 'Author', last_name: 'Name', role: user.role }
  });
});

app.get('/api/dashboard', (req, res) => {
  res.json({ id: 1, username: 'testuser', email: 'test@example.com', first_name: 'Test', last_name: 'User' });
});

app.get('/api/books', (req, res) => {
  res.json(db.books);
});

app.get('/api/recommendations', (req, res) => {
  res.json(db.recommendations);
});

app.post('/api/upload-text', (req, res) => {
  const { author, authorId, text, format, threeDObject } = req.body;

  console.log(`Processing upload from ${author} (ID: ${authorId}) in ${format} format...`);

  const newPendingText: PendingText = {
    id: Date.now(),
    author,
    authorId,
    text: text || 'No text provided',
    format,
    threeDObject,
    status: 'pending',
    timestamp: new Date().toISOString()
  };

  db.pendingTexts.push(newPendingText);
  res.status(201).json({ message: 'Text uploaded successfully and is pending approval.', text: newPendingText });
});

// Endpoint for admin to approve text and move it to recommendations
app.post('/api/approve-text', (req, res) => {
  const { id } = req.body;
  const index = db.pendingTexts.findIndex(t => t.id === id);

  if (index === -1) {
    return res.status(404).json({ message: 'Text not found.' });
  }

  const textToApprove = db.pendingTexts.splice(index, 1)[0];
  const recommendation: Recommendation = {
    id: textToApprove.id,
    title: `Recommended Read: ${textToApprove.author}'s Work`,
    author: textToApprove.author,
    text: textToApprove.text,
    authorId: textToApprove.authorId,
    threeDObject: textToApprove.threeDObject,
    views: 0
  };

  db.recommendations.push(recommendation);
  return res.json({ message: 'Text approved and added to recommendations.', recommendation });
});

app.get('/api/author/work', (req, res) => {
  const authorId = parseInt(req.query['authorId'] as string);
  if (!authorId) {
    return res.status(400).json({ message: 'authorId is required' });
  }

  const pending = db.pendingTexts.filter(t => t.authorId === authorId);
  const approved = db.recommendations.filter(r => r.authorId === authorId);

  return res.json({ pending, approved });
});

app.post('/api/recommendations/:id/view', (req, res) => {
  const id = parseInt(req.params.id);
  const recommendation = db.recommendations.find(r => r.id === id);

  if (!recommendation) {
    return res.status(404).json({ message: 'Recommendation not found.' });
  }

  recommendation.views++;
  return res.json({ message: 'View count incremented.', views: recommendation.views });
});

const angularApp = new AngularNodeAppEngine();

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
