import { createClient } from '@supabase/supabase-js';

// Tomar supabase dashboard theke ei URL r KEY boshabe
const supabaseUrl = 'https://mllsdlbhxetctblonfec.supabase.co';
const supabaseKey = 'sb_publishable_G3pnWovIAJeeiegVifAY7Q_3Zl9PNwj';

export const supabase = createClient(supabaseUrl, supabaseKey);