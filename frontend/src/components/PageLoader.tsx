export function PageLoader() {
  return (
    <main className="page-shell" role="status" aria-live="polite" aria-busy="true">
      <section className="panel page-loader">
        <p className="eyebrow">Chargement</p>
        <h2>On prépare la vue.</h2>
        <p>Les données et composants de cette page arrivent.</p>
      </section>
      <div className="loading-preview" aria-hidden="true"><div /><div /><div /></div>
    </main>
  );
}
