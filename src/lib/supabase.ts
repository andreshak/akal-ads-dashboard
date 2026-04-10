import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pnivbhpqacugqtjfgmki.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuaXZiaHBxYWN1Z3F0amZnbWtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Nzc2MTIsImV4cCI6MjA5MTM1MzYxMn0.QYB-CmJ_0xE-b1opZens15Jz3xCg6voILRPHwhrzC5E";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
