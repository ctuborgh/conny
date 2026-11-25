// Forbindelsen til Supabase. Udfyldes under opsætningen (se OPSAETNING.md).
// Så længe supabaseUrl er null, kører appen i demo-tilstand.
// Alle tre værdier er offentlige og må gerne ligge på GitHub:
// databasens adgangsregler beskytter familiens data.
self.CONNY_CONFIG = {
  supabaseUrl: null,     // fx 'https://abcdefgh.supabase.co'
  supabaseKey: null,     // "anon public"-nøglen
  vapidPublicKey: "BF1jcaaZhLK47zLEUt1DqtWpfCmAa-H7kCQvYSmFtfC8ZnftStuLZB0WlU6wgynqfFPj4niCjYyk-cs1PEXpB8g",  // offentlig nøgle til påmindelser
};
