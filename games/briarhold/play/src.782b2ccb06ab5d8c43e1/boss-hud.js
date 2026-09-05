/** Reset every mutable boss HUD field when combat authority ends. */
export function clearBossHudPresentation({
  status,
  name,
  healthText,
  healthBar,
  individuals,
  counter,
} = {}) {
  if (status) {
    status.hidden = true;
    status.setAttribute?.('aria-label', 'Boss health');
  }
  if (name) name.textContent = '';
  if (healthText) healthText.textContent = '';
  if (individuals) individuals.textContent = '';
  if (counter) counter.textContent = '';
  if (healthBar) {
    healthBar.setAttribute?.('aria-label', 'Boss health');
    healthBar.setAttribute?.('aria-valuenow', '0');
    const fill = healthBar.querySelector?.('span');
    if (fill?.style) fill.style.transform = 'scaleX(0)';
  }
}
