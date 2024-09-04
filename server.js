/*
<An application to manage the inventory count and analysis of the most popular vehicles on sale.>
Copyright (C) 2024  Darel Johnson

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/


import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { Database } from 'bun:sqlite';
import figlet from 'figlet';
import pg from 'pg';
import { parse } from 'csv-parse';

const app = new Hono();

// Database connection setup
let db;
const isProd = process.env.NODEENV === 'production';

async function connectToDatabase() {
  try {
    if (isProd) {
      const { Pool } = pg;
      db = new Pool({
        connectionString: process.env.DATABASEURL,
        ssl: { rejectUnauthorized: false }
      });
      // Test the connection
      await db.query('SELECT 1');
      console.log("Connected to PostgreSQL");
    } else {
      db = new Database('vehicles.db');
      console.log("Connected to SQLite");
    }
  } catch (error) {
    console.error("Error connecting to database:", error);
    if (isProd) {
      console.log("DATABASE_URL:", process.env.DATABASEURL);
    }
    throw error;
  }
}

// Initialize database
async function initDB() {
  try {
    if (isProd) {
      await db.query(`
        CREATE TABLE IF NOT EXISTS vehicles (
          id SERIAL PRIMARY KEY,
          make TEXT,
          model TEXT,
          year INTEGER,
          count INTEGER DEFAULT 0
        )
      `);
    } else {
      db.query(`CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        make TEXT,
        model TEXT,
        year INTEGER,
        count INTEGER DEFAULT 0
      )`).run();
    }
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}

// Connect to the database and initialize it
async function setupDatabase() {
  try {
    await connectToDatabase();
    await initDB();
  } catch (error) {
    console.error("Failed to setup database:", error);
    process.exit(1);
  }
}

// Helper function for database queries
async function dbQuery(query, params = []) {
  if (isProd) {
    const result = await db.query(query, params);
    return result.rows;
  } else {
    return db.query(query).all(...params);
  }
}

// API routes
app.get('/api/vehicles', async (c) => {
  const vehicles = await dbQuery('SELECT * FROM vehicles');
  return c.json(vehicles);
});

app.post('/api/vehicles', async (c) => {
  const { make, model, year } = await c.req.json();
  let result;
  if (isProd) {
    result = await db.query('INSERT INTO vehicles (make, model, year) VALUES ($1, $2, $3) RETURNING id', [make, model, year]);
    return c.json({ success: true, id: result.rows[0].id });
  } else {
    result = db.query('INSERT INTO vehicles (make, model, year) VALUES (?, ?, ?)').run(make, model, year);
    return c.json({ success: true, id: result.lastInsertId });
  }
});

app.put('/api/vehicles/:id', async (c) => {
  const id = c.req.param('id');
  const { make, model, year } = await c.req.json();
  if (isProd) {
    await db.query('UPDATE vehicles SET make = $1, model = $2, year = $3 WHERE id = $4', [make, model, year, id]);
  } else {
    db.query('UPDATE vehicles SET make = ?, model = ?, year = ? WHERE id = ?').run(make, model, year, id);
  }
  return c.json({ success: true });
});

app.delete('/api/vehicles/:id', async (c) => {
  const id = c.req.param('id');
  if (isProd) {
    await db.query('DELETE FROM vehicles WHERE id = $1', [id]);
  } else {
    db.query('DELETE FROM vehicles WHERE id = ?').run(id);
  }
  return c.json({ success: true });
});

app.get('/api/analysis', async (c) => {
  const vehicles = await dbQuery('SELECT *, (SELECT SUM(count) FROM vehicles) as totalCount FROM vehicles');
  return c.json({ vehicles, totalCount: vehicles[0]?.totalCount || 0 });
});

app.post('/api/count/:id', async (c) => {
  const id = c.req.param('id');
  if (isProd) {
    await db.query('UPDATE vehicles SET count = count + 1 WHERE id = $1', [id]);
  } else {
    db.query('UPDATE vehicles SET count = count + 1 WHERE id = ?').run(id);
  }
  return c.json({ success: true });
});

// Replace the existing /api/export route with this new implementation
app.get('/api/export', async (c) => {
  console.log('Export request received');
  try {
    const vehicles = await dbQuery('SELECT * FROM vehicles');
    console.log(`Retrieved ${vehicles.length} vehicles`);

    let csvContent = "ID,Make,Model,Year,Count\n";
    vehicles.forEach(vehicle => {
      csvContent += `${vehicle.id},${vehicle.make},${vehicle.model},${vehicle.year},${vehicle.count}\n`;
    });

    c.header('Content-Disposition', 'attachment; filename=vehicles_export.csv');
    c.header('Content-Type', 'text/csv');

    return c.body(csvContent);
  } catch (error) {
    console.error('Error in /api/export:', error);
    return c.json({ error: error.message || 'An unknown error occurred' }, 500);
  }
});

// Serve static files
app.use('/*', serveStatic({ root: './' }));

// Catch-all route for SPA
app.get('*', (c) => {
  return c.html(Bun.file('./index.html'));
});

const port = process.env.PORT || 3001;
console.log(`Server is running on port ${port}`);

console.log(figlet.textSync('Bun!', {
  font: 'Standard',
  horizontalLayout: 'default',
  verticalLayout: 'default',
  width: 80,
  whitespaceBreak: true
}));

// New import route
app.post('/api/import', async (c) => {
  console.log('Import request received');
  try {
    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    const content = await file.text();
    const records = await new Promise((resolve, reject) => {
      parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }, (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });

    let importedCount = 0;
    let skippedCount = 0;

    for (const record of records) {
      const { make, model, year, count } = record;
      
      // Skip the row if any required field is empty
      if (!make || !model || !year) {
        skippedCount++;
        continue;
      }

      // Check if the vehicle already exists
      const existingVehicle = await dbQuery('SELECT * FROM vehicles WHERE make = $1 AND model = $2 AND year = $3', [make, model, year]);

      if (existingVehicle.length > 0) {
        // Skip existing vehicle
        skippedCount++;
      } else {
        // Insert new vehicle
        if (isProd) {
          await db`INSERT INTO vehicles (make, model, year, count) VALUES (${make}, ${model}, ${parseInt(year)}, ${parseInt(count) || 0})`;
        } else {
          db.query('INSERT INTO vehicles (make, model, year, count) VALUES (?, ?, ?, ?)').run(make, model, parseInt(year), parseInt(count) || 0);
        }
        importedCount++;
      }
    }

    return c.json({ 
      message: `Successfully imported ${importedCount} new vehicles. Skipped ${skippedCount} existing or invalid entries.` 
    });
  } catch (error) {
    console.error('Error in /api/import:', error);
    return c.json({ error: error.message || 'An unknown error occurred' }, 500);
  }
});


// Call setupDatabase before starting the server
setupDatabase().then(() => {
  console.log("Database setup complete, starting server...");
  // Start your server here
}).catch(error => {
  console.error("Critical error during database setup:", error);
  process.exit(1);
});

export default {
  port: port,
  fetch: app.fetch,
};
