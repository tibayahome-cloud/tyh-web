type OrderedCatalogGroup = {
  key?: string | null;
  name?: string | null;
  displayOrder?: number | null;
};

const SPECIALIST_PATTERN = /\b(specialist|specialty|specialties)\b/i;

/** Keep the catalog's configured order, but put specialist care first for clients. */
export const sortSpecialistFirst = <T extends OrderedCatalogGroup>(groups: T[]): T[] =>
  groups
    .map((group, index) => ({ group, index }))
    .sort((left, right) => {
      const leftPriority = SPECIALIST_PATTERN.test(`${left.group.key ?? ""} ${left.group.name ?? ""}`) ? 0 : 1;
      const rightPriority = SPECIALIST_PATTERN.test(`${right.group.key ?? ""} ${right.group.name ?? ""}`) ? 0 : 1;

      if (leftPriority !== rightPriority) return leftPriority - rightPriority;

      const leftOrder = left.group.displayOrder ?? 0;
      const rightOrder = right.group.displayOrder ?? 0;
      return leftOrder - rightOrder || left.index - right.index;
    })
    .map(({ group }) => group);
