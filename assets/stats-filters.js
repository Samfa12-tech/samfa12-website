(() => {
  const controls = document.querySelector('[data-stats-filters]');
  const grid = document.querySelector('[data-marketplace-projects]');
  if (!controls || !grid) return;
  const status = document.querySelector('[data-stats-filter-status]');
  const empty = document.querySelector('[data-stats-empty]');
  const cards = [...grid.children].map(node => ({node, title: node.querySelector('h3').textContent, platform: node.querySelector('.technical-label').textContent}));
  const platforms = [...new Set(cards.map(card => card.platform))];
  let platform = 'All';
  controls.innerHTML = `<div class="catalogue-controls-panel"><div class="catalogue-control-group catalogue-search"><label class="catalogue-control-label" for="stats-release-search">Find a release</label><div class="catalogue-search-row"><input class="catalogue-select" id="stats-release-search" type="search" placeholder="Search release titles" autocomplete="off" aria-controls="stats-release-grid"><button class="filter-btn" type="button" data-clear-stats>Reset filters</button></div></div><div class="catalogue-control-group"><p class="catalogue-control-label">Platform</p><div class="filter-row" role="group" aria-label="Statistics platform filters"></div></div></div>`;
  const search = controls.querySelector('input');
  const row = controls.querySelector('.filter-row');
  const buttons = ['All', ...platforms].map(label => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'filter-btn'; button.textContent = label;
    button.setAttribute('aria-controls', 'stats-release-grid');
    button.addEventListener('click', () => { platform = label; update(); });
    row.append(button); return button;
  });
  function update() {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    cards.forEach(card => {
      card.node.hidden = !((platform === 'All' || platform === card.platform) && card.title.toLocaleLowerCase().includes(query));
      if (!card.node.hidden) visible++;
    });
    buttons.forEach(button => { const active = button.textContent === platform; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    status.textContent = `Showing ${visible} of ${cards.length} releases. ${platform === 'All' ? 'All platforms' : platform}${query ? `; search: ${search.value.trim()}` : ''}.`;
    empty.hidden = visible !== 0;
  }
  search.addEventListener('input', update);
  controls.querySelector('[data-clear-stats]').addEventListener('click', () => { platform = 'All'; search.value = ''; update(); search.focus(); });
  controls.hidden = false; status.hidden = false; update();
})();
