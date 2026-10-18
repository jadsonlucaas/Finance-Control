export function installLucideIconScheduler(target = globalThis) {
  if (!target?.lucide?.createIcons || target.__financeLucideSchedulerInstalled) return false;

  target.__financeLucideSchedulerInstalled = true;
  const createIconsNow = target.lucide.createIcons.bind(target.lucide);
  let iconFrame = 0;

  target.lucide.createIcons = (...args) => {
    if (args.length) return createIconsNow(...args);
    if (iconFrame) return undefined;

    iconFrame = target.requestAnimationFrame(() => {
      iconFrame = 0;
      createIconsNow();
    });

    return undefined;
  };

  return true;
}
