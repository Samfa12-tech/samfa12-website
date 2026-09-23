export function sitemapEntries(siteRoutes, manifest, hubs) {
  return [
    ...siteRoutes.map(({route,pageModified}) => [route,pageModified]),
    ...manifest.products.filter(({action}) => action === "create").map(({path,pageModified}) => [path,pageModified]),
    ...hubs.map(({route,pageModified}) => [route,pageModified]),
  ];
}

export function validateUpdateDates(siteRoutes, manifest, copy) {
  const updatesDate = siteRoutes.find(({route}) => route === "/updates/")?.pageModified;
  if (!updatesDate) throw Error("Updates page needs a modification date");
  for (const plan of manifest.products) {
    for (const update of copy[plan.id]?.updates || []) {
      if (plan.pageModified < update.date) throw Error(`${plan.id} pageModified predates update ${update.id}`);
      if (updatesDate < update.date) throw Error(`/updates/ pageModified predates update ${update.id}`);
    }
  }
}
