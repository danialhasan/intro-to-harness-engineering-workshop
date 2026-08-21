export type Service = {
  name: string;
  enabled: boolean;
  dependsOn: string[];
};

export function planRelease(services: Service[]): string[] {
  const byName = new Map(services.map((service) => [service.name, service]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const order: string[] = [];

  const visit = (service: Service): void => {
    if (!service.enabled || visited.has(service.name)) return;
    if (visiting.has(service.name)) throw new Error(`dependency cycle at ${service.name}`);
    visiting.add(service.name);
    for (const dependencyName of service.dependsOn) {
      const dependency = byName.get(dependencyName);
      if (!dependency || !dependency.enabled) throw new Error(`unavailable dependency ${dependencyName}`);
      visit(dependency);
    }
    visiting.delete(service.name);
    visited.add(service.name);
    order.push(service.name);
  };

  for (const service of services) visit(service);
  return order;
}
