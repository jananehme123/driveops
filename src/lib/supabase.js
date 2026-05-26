import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://feuyhkqwdyequsyxnwgh.supabase.co'
const supabaseKey = 'sb_publishable_M_h-SZ1PbFsSMLHPe9-mdw_UWEfj0wL'

export const supabase = createClient(supabaseUrl, supabaseKey)
