import { Database } from "lucide-react";

export default function SetupPanel() {
  return (
    <div className="app-shell">
      <section className="setup-panel">
        <Database size={34} />
        <h1>Supabase setup required</h1>
        <p>Create a `.env` file from `.env.example`, add your Supabase URL and anon key, then restart the dev server.</p>
        <p>Run `supabase-schema.sql` in the Supabase SQL Editor before using the app.</p>
      </section>
    </div>
  );
}
