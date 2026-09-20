export default function Home() {
  return (
    <main>
      <h1>Hired Hand: Career Finder — API proxy</h1>
      <p>
        This service has no user interface. It proxies a fixed allow-list of O*NET Web Services{' '}
        <code>/mnm</code> endpoints for the Hired Hand: Career Finder Chrome extension at{' '}
        <code>/api/onet/[...path]</code>, injecting the O*NET API key server-side so it never ships
        inside the extension bundle. See the repository README for details.
      </p>
    </main>
  );
}
