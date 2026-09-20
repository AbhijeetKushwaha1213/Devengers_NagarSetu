# Debug: Localhost vs Network IP Issue

## Let's diagnose the exact problem

### Step 1: Check What's Actually Failing

Open your browser's Developer Tools (F12) and compare:

#### On `http://localhost:8080/`:
1. Go to **Console** tab - look for errors
2. Go to **Network** tab - check for failed requests
3. Go to **Application** tab → **Local Storage** - check if environment variables are loaded

#### On `http://10.96.207.151:8080/`:
1. Do the same checks
2. Compare the differences

### Step 2: Common Issues to Check

#### Environment Variables
In browser console, run:
```javascript
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('VITE_GOOGLE_MAPS_API_KEY:', import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
console.log('All env vars:', import.meta.env);
```

#### Supabase Connection
```javascript
// Check if Supabase is connecting
import { supabase } from './src/lib/supabase';
supabase.from('issues').select('count').then(console.log).catch(console.error);
```

#### Network Requests
Look for failed requests to:
- Supabase API calls
- Google Maps API
- Any other external APIs

### Step 3: Try These Solutions

#### Solution 1: Use 127.0.0.1 instead of localhost
Try: `http://127.0.0.1:8080/`

#### Solution 2: Clear Browser Data
1. Open DevTools (F12)
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"

#### Solution 3: Check DNS Resolution
In terminal:
```bash
# Check what localhost resolves to
ping localhost
nslookup localhost
```

#### Solution 4: Try Different Browser
Test in:
- Chrome Incognito mode
- Firefox
- Safari

### Step 4: Report Back

Please tell me:
1. What specific errors you see in Console tab?
2. What requests fail in Network tab?
3. Do environment variables show up correctly?
4. Does `http://127.0.0.1:8080/` work?
5. What does `ping localhost` show?

This will help me identify the exact issue and provide a targeted fix.