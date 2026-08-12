import StockApp from "./stock-app";

export const dynamic = "force-dynamic";

export default function Page() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return (
      <main className="authShell">
        <section className="authCard connectionCard">
          <span className="authLogo">IF</span>
          <p className="eyebrow">Configuración pendiente</p>
          <h1>Falta conectar la base de datos</h1>
          <p>La aplicación necesita la URL y la clave pública de Supabase para iniciar.</p>
        </section>
      </main>
    );
  }

  return <StockApp supabaseUrl={supabaseUrl} supabasePublishableKey={supabasePublishableKey} />;
}
