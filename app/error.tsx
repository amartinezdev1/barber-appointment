'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="manage-page"><h1>No pudimos cargar esta página.</h1><p>Intenta de nuevo en unos momentos.</p><button className="button primary" onClick={reset}>Volver a intentar</button></main>;}
