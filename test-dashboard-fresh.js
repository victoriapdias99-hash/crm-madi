// Test dashboard with fresh data
async function test() {
  // Add random query param to force fresh data
  const res = await fetch(`http://localhost:5000/api/dashboard/campanas-pendientes?t=${Date.now()}`);
  const json = await res.json();
  const camp84 = json.find(c => c.campaignId === 84);

  console.log('Dashboard para campaña 84 (fresh):');
  console.log('  enviados:', camp84?.enviados);
}

test();
