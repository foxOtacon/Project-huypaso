# Village Products

## Migration to Supabase

The server now supports Supabase/Postgres via the connection string in the environment file.

### 1. Add environment variables
Create a .env file in the project root with:

```env
VITE_API_URL=/api
SUPABASE_DB_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres
```

### 2. Apply the schema
Run the SQL from [server/database/supabase-schema.sql](server/database/supabase-schema.sql) in the Supabase SQL editor.

### 3. Start the backend
```bash
cd server
npm install
npm run dev
```

### Notes
- The server still uses the same API routes and controller logic.
- SQL placeholders were converted from MySQL-style ? to PostgreSQL-style $1, $2, etc.
- The adapter also maps common MySQL error codes to Supabase/Postgres equivalents.
