const WEAPON_TITLES = Object.freeze({arbalest: "Arbalest", sunfire: "Sunfire", runebolt: "Runebolt"});

export function createProgressionAtlasState(model, previous = {}) {
  const tabIds = model.tabs.map(({id}) => id);
  const activeTab = tabIds.includes(previous.activeTab) ? previous.activeTab : tabIds[0];
  const masteryRows = model.sections.find(({id}) => id === "mastery")?.rows ?? [];
  const weaponIds = [...new Set(masteryRows.map(({weaponId}) => weaponId).filter(Boolean))];
  const activeWeapon = weaponIds.includes(previous.activeWeapon) ? previous.activeWeapon : weaponIds[0];
  const rows = rowsForChapter(model, activeTab, activeWeapon);
  const selectedId = rows.some(({id}) => id === previous.selectedId) ? previous.selectedId : rows[0]?.id ?? null;
  return {activeTab, activeWeapon, selectedId, detailsOpen: previous.detailsOpen !== false};
}

export function selectProgressionNode(model, state, nodeId) {
  const rows = rowsForChapter(model, state.activeTab, state.activeWeapon);
  if (!rows.some(({id}) => id === nodeId)) return state;
  return {...state, selectedId: nodeId, detailsOpen: true};
}

export function rowsForChapter(model, activeTab, activeWeapon) {
  const sectionIds = model.tabs.find(({id}) => id === activeTab)?.sectionIds ?? [];
  return model.sections.filter(({id}) => sectionIds.includes(id)).flatMap(({rows}) => rows)
    .filter((row) => activeTab !== "weapon-mastery" || row.weaponId === activeWeapon);
}

export function renderProgressionAtlas({model, state: requestedState, tabs, content, applyIcon}) {
  const state = createProgressionAtlasState(model, requestedState);
  tabs.replaceChildren();
  content.replaceChildren();
  for (const tab of model.tabs) {
    const button = element("button", "oath-hall-tab secondary-button", tab.title);
    button.type = "button";
    button.dataset.oathTab = tab.id;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(tab.id === state.activeTab));
    button.tabIndex = tab.id === state.activeTab ? 0 : -1;
    tabs.append(button);
  }

  const shell = element("div", "atlas-chapter");
  shell.dataset.chapter = state.activeTab;
  const map = element("div", "atlas-map");
  const details = element("aside", "atlas-detail");
  if (state.activeTab === "weapon-mastery") {
    const weaponTabs = element("div", "atlas-weapon-tabs");
    weaponTabs.setAttribute("role", "tablist");
    for (const [id, title] of Object.entries(WEAPON_TITLES)) {
      const button = element("button", "atlas-weapon-tab secondary-button", title);
      button.type = "button";
      button.dataset.weaponTab = id;
      button.setAttribute("aria-selected", String(id === state.activeWeapon));
      weaponTabs.append(button);
    }
    shell.append(weaponTabs);
  }
  const sections = model.tabs.find(({id}) => id === state.activeTab)?.sectionIds ?? [];
  for (const section of model.sections.filter(({id}) => sections.includes(id))) {
    const rows = section.rows.filter((row) => state.activeTab !== "weapon-mastery" || row.weaponId === state.activeWeapon);
    if (!rows.length) continue;
    const group = element("section", `atlas-group atlas-group-${section.id}`);
    group.append(element("h3", "", section.title));
    const track = element("div", "atlas-track");
    for (const row of rows) {
      const node = element("button", `atlas-node is-${row.status ?? "available"}`);
      node.type = "button";
      node.dataset.oathNode = row.id;
      node.dataset.oathActionId = row.actionId;
      node.setAttribute("aria-pressed", String(row.id === state.selectedId));
      node.setAttribute("aria-label", `${row.title}. ${row.detail}`);
      if (row.prerequisiteId) node.dataset.prerequisite = row.prerequisiteId;
      const art = element("span", "atlas-node-art");
      applyIcon?.(art, row.actionId === "commission:warden-focus" ? "commission:warden-focus" : row.id);
      const copy = element("span", "atlas-node-copy");
      copy.append(element("strong", "", row.title), element("small", "", row.detail));
      if (row.maxRank) copy.append(rankTrack(row.rank, row.maxRank));
      node.append(art, copy);
      track.append(node);
    }
    group.append(track);
    map.append(group);
  }
  const selected = rowsForChapter(model, state.activeTab, state.activeWeapon).find(({id}) => id === state.selectedId);
  if (selected && state.detailsOpen) renderDetail(details, selected, model.readOnly, applyIcon);
  else details.append(element("p", "atlas-detail-copy", "Choose a crest to inspect its oath, cost and requirements."));
  shell.append(map, details);
  content.append(shell);
  return state;
}

function renderDetail(details, row, readOnly, applyIcon) {
  const art = element("div", "atlas-detail-art");
  applyIcon?.(art, row.actionId === "commission:warden-focus" ? "commission:warden-focus" : row.id);
  const kicker = row.detail;
  details.append(art, element("p", "eyebrow", kicker), element("h3", "", row.title), element("p", "atlas-detail-copy", row.description));
  if (row.maxRank) details.append(rankTrack(row.rank, row.maxRank));
  if (Number.isFinite(row.cost)) details.append(element("p", "atlas-detail-copy atlas-detail-cost", `Cost: ${row.cost} ${row.cost === 1 ? "Oathmark" : "Oathmarks"}`));
  const action = element("button", "primary-button atlas-detail-action", readOnly ? "Host chooses upgrades" : row.actionLabel);
  action.type = "button";
  action.dataset.oathAction = row.actionId;
  action.disabled = readOnly || row.disabled;
  details.append(action);
}

function rankTrack(rank, maximum) {
  const track = element("span", "atlas-rank-track");
  track.setAttribute("aria-label", `Rank ${rank} of ${maximum}`);
  for (let index = 1; index <= maximum; index += 1) track.append(element("i", index <= rank ? "is-filled" : "", String(index)));
  return track;
}

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
