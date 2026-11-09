export default function NewsLoading() {
  return <main className="news-journal news-loading" aria-busy="true">
    <p role="status">Chargement des actualités… / Loading news…</p>
    <div className="container">
      <div className="news-loading-feature"><span/><div><i/><i/><i/></div></div>
      <div className="news-loading-grid"><span/><span/><span/></div>
    </div>
  </main>;
}
