import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vphpefcowvfpmvrvkops.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwaHBlZmNvd3ZmcG12cnZrb3BzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NTgyMjksImV4cCI6MjA4MDIzNDIyOX0.yJyLG4SMGmk1yKXSxK9Eo3lbUommzuySKtfHzMCk1zo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);