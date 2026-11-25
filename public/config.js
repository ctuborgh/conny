// Forbindelsen til Supabase. Udfyldes under opsætningen (se OPSAETNING.md).
// Så længe supabaseUrl er null, kører appen i demo-tilstand.
// Alle tre værdier er offentlige og må gerne ligge på GitHub:
// databasens adgangsregler beskytter familiens data.
self.CONNY_CONFIG = {
  supabaseUrl: 'https://zekkrswklmyskzmmzmpn.supabase.co',     // fx 'https://abcdefgh.supabase.co'
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2tyc3drbG15c2t6bW16bXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1ODU4MTEsImV4cCI6MjExMTE2MTgxMX0.OqIlfG1Yn4iUVd2W1UKtpOnPhL8zuYSb2LshfSs0g58',     // "anon public"-nøglen
  vapidPublicKey: "BF1jcaaZhLK47zLEUt1DqtWpfCmAa-H7kCQvYSmFtfC8ZnftStuLZB0WlU6wgynqfFPj4niCjYyk-cs1PEXpB8g",  // offentlig nøgle til påmindelser
};
