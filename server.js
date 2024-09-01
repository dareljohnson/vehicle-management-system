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

const app = new Hono();
const db = new Database('vehicles.db');

db.query(`CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    make TEXT,
    model TEXT,
    year INTEGER,
    count INTEGER DEFAULT 0
)`).run();

// API routes
app.get('/api/vehicles', (c) => {
    const vehicles = db.query('SELECT * FROM vehicles').all();
    return c.json(vehicles);
});

app.post('/api/vehicles', async (c) => {
    const { make, model, year } = await c.req.json();
    const result = db.query('INSERT INTO vehicles (make, model, year) VALUES (?, ?, ?)').run(make, model, year);
    return c.json({ success: true, id: result.lastInsertId });
});

app.put('/api/vehicles/:id', async (c) => {
    const id = c.req.param('id');
    const { make, model, year } = await c.req.json();
    const result = db.query('UPDATE vehicles SET make = ?, model = ?, year = ? WHERE id = ?').run(make, model, year, id);
    return c.json({ success: true, changes: result.changes });
});

app.delete('/api/vehicles/:id', (c) => {
    const id = c.req.param('id');
    db.query('DELETE FROM vehicles WHERE id = ?').run(id);
    return c.json({ success: true });
});

app.get('/api/analysis', (c) => {
    const vehicles = db.query('SELECT *, (SELECT SUM(count) FROM vehicles) as totalCount FROM vehicles').all();
    return c.json({ vehicles, totalCount: vehicles[0]?.totalCount || 0 });
});

app.post('/api/count/:id', (c) => {
    const id = c.req.param('id');
    db.query('UPDATE vehicles SET count = count + 1 WHERE id = ?').run(id);
    return c.json({ success: true });
});

// Replace the existing /api/export route with this new implementation
app.get('/api/export', (c) => {
    console.log('Export request received');
    try {
        const vehicles = db.query('SELECT * FROM vehicles').all();
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
        const lines = content.split('\n');
        
        // Skip the header row
        lines.shift();

        let importedCount = 0;
        let skippedCount = 0;

        for (const line of lines) {
            if (line.trim() === '') continue;
            const [make, model, year, count] = line.split(',');
            
            // Check if the vehicle already exists
            const existingVehicle = db.query('SELECT * FROM vehicles WHERE make = ? AND model = ? AND year = ?')
                .get(make, model, year);

            if (existingVehicle) {
                // Skip existing vehicle
                skippedCount++;
            } else {
                // Insert new vehicle
                db.query('INSERT INTO vehicles (make, model, year, count) VALUES (?, ?, ?, ?)')
                    .run(make, model, parseInt(year), parseInt(count));
                importedCount++;
            }
        }

        return c.json({ 
            message: `Successfully imported ${importedCount} new vehicles. Skipped ${skippedCount} existing vehicles.` 
        });
    } catch (error) {
        console.error('Error in /api/import:', error);
        return c.json({ error: error.message || 'An unknown error occurred' }, 500);
    }
});

export default {
    port: port,
    fetch: app.fetch,
};
