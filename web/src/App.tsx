import { BRANCHES } from '@app/shared';

function App() {
  return (
    <main>
      <h1>Öğretmen Video Çözüm Platformu</h1>
      <p>Branşlar (ortak paketten):</p>
      <ul>
        {BRANCHES.map((branch) => (
          <li key={branch}>{branch}</li>
        ))}
      </ul>
    </main>
  );
}

export default App;
