export type Service = {
  name: string;
  enabled: boolean;
  dependsOn: string[];
};

export function planRelease(services: Service[]): string[] {
  return services.filter((service) => service.enabled).map((service) => service.name).sort();
}
