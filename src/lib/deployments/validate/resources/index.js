import { InvalidDeploymentError } from "errors";
import { get } from "lodash";

export function validateComponent(component, max, defaultAU, properties) {
  const { cpu, memory } = get(component, "resources.limits");
  if (cpu > parseInt(max.cpu))
    throw new InvalidDeploymentError("Maximum CPU for pod exceeded");
  if (memory > parseInt(max.memory))
    throw new InvalidDeploymentError("Maximum Memory for pod exceeded");
  if (defaultAU && defaultAU > parseInt(properties.extra_au)) {
    throw new InvalidDeploymentError("Minimum Extra AU not met");
  }
}

// Validate component resources
export default function validateResources(
  resources = {},
  max,
  defaultAU,
  properties
) {
  const { scheduler, webserver } = resources;
  if (scheduler) validateComponent(scheduler, max, defaultAU, properties);
  if (webserver) validateComponent(webserver, max, defaultAU, properties);
}
