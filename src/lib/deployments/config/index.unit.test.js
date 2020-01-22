import {
  airflowImageForVersion,
  airflowImageTag,
  mapResources,
  objectToArrayOfKeyValue,
  arrayOfKeyValueToObject,
  generateHelmValues,
  limitRange,
  constraints,
  mapPropertiesToDeployment,
  mapDeploymentToProperties,
  findLatestTag,
  generateNextTag,
  generateDefaultTag,
  deploymentOverrides,
  mapCustomEnvironmentVariables,
  platform
} from "./index";
import { generateReleaseName } from "deployments/naming";
import casual from "casual";
import config from "config";
import {
  AIRFLOW_EXECUTOR_LOCAL,
  DEPLOYMENT_PROPERTY_EXTRA_AU,
  DEPLOYMENT_PROPERTY_COMPONENT_VERSION,
  DEPLOYMENT_PROPERTY_ALERT_EMAILS
} from "constants";

describe("generateHelmValues", () => {
  test("generates correct shape with default/missing deployment config", () => {
    const deployment = {
      id: casual.uuid,
      releaseName: generateReleaseName(),
      workspace: {
        id: casual.uuid
      }
    };
    const config = generateHelmValues(deployment);
    expect(config).toHaveProperty("ingress");
    expect(config).toHaveProperty("networkPolicies");
    expect(config).toHaveProperty("scheduler.resources.requests");
    expect(config).toHaveProperty("scheduler.resources.limits");
    expect(config).toHaveProperty("webserver.resources.requests");
    expect(config).toHaveProperty("webserver.resources.limits");
    expect(config).toHaveProperty("pgbouncer");
    expect(config).toHaveProperty("limits");
    expect(config).toHaveProperty("quotas");
  });
});

describe("limitRange", () => {
  test("generates correct values", () => {
    const config = limitRange();
    expect(config).toHaveProperty("limits");
    expect(config.limits).toHaveLength(2);
  });

  describe("in singleNamespace mode", () => {
    beforeAll(() => (config.helm.singleNamespace = true));
    afterAll(() => (config.helm.singleNamespace = false));
    test("Doesn't specify any limits", () => {
      expect(limitRange()).toEqual({});
    });
  });
});

describe("constraints", () => {
  test("correctly applies constraints for missing/default config", () => {
    const deployment = {
      id: casual.uuid
    };
    const config = constraints(deployment);
    expect(config.quotas.pods).toBe(14); // Default celery (7 pods), doubled.
    expect(config.quotas["requests.cpu"]).toBe("6200m"); // 2500 doubled + 300 sidecar doubled
    expect(config.quotas["requests.memory"]).toBe("23808Mi"); // 9600 doubled + 768 sidecar doubled
    expect(config.quotas["requests.cpu"]).toBe(config.quotas["requests.cpu"]);
    expect(config.quotas["requests.memory"]).toBe(
      config.quotas["requests.memory"]
    );
    expect(config.pgbouncer.metadataPoolSize).toBe(14);
    expect(config.pgbouncer.maxClientConn).toBe(140);
    expect(config).not.toHaveProperty("allowPodLaunching");
  });

  describe("in singleNamespace mode", () => {
    beforeAll(() => (config.helm.singleNamespace = true));
    afterAll(() => (config.helm.singleNamespace = false));
    test("Doesn't specify any quotas", () => {
      const deployment = {
        id: casual.uuid
      };
      expect(constraints(deployment)).toEqual({});
    });
  });

  test("correctly applies constraints for extra au property", () => {
    const deployment = {
      id: casual.uuid,
      extraAu: 10
    };
    const config = constraints(deployment);
    expect(config.quotas.pods).toBe(24); // Same as default celery + 10 extra
    expect(config.quotas["requests.cpu"]).toBe("7200m"); // Same as default celery + 1000 extra
    expect(config.quotas["requests.memory"]).toBe("27648Mi"); // Same as default celery + 3840 extra
    expect(config.quotas["requests.cpu"]).toBe(config.quotas["requests.cpu"]);
    expect(config.quotas["requests.memory"]).toBe(
      config.quotas["requests.memory"]
    );
    expect(config.pgbouncer.metadataPoolSize).toBe(19); // Same as celery default + 5 (.5 * 10)
    expect(config.pgbouncer.maxClientConn).toBe(190); // Same as celery default + 50 (5 * 10)
  });

  test("correctly applies constraints for LocalExecutor config", () => {
    const deployment = {
      id: casual.uuid,
      config: { executor: AIRFLOW_EXECUTOR_LOCAL }
    };
    const config = constraints(deployment);
    expect(config.quotas.pods).toBe(8); // Local (4 pods), doubled.
    expect(config.quotas["requests.cpu"]).toBe("3400m"); // 1100 doubled + 300 sidecar doubled
    expect(config.quotas["requests.memory"]).toBe("13056Mi"); // 4224 doubled + 1152 sidecar doubled
    expect(config.quotas["requests.cpu"]).toBe(config.quotas["requests.cpu"]);
    expect(config.quotas["requests.memory"]).toBe(
      config.quotas["requests.memory"]
    );
    expect(config.pgbouncer.metadataPoolSize).toBe(7);
    expect(config.pgbouncer.maxClientConn).toBe(70);
    expect(config).not.toHaveProperty("allowPodLaunching");
  });
});

describe("mapResources", () => {
  test("mapResources correctly maps values", () => {
    const au = {
      cpu: 100,
      memory: 384
    };

    const auType = "default";

    const comp = {
      name: "scheduler",
      au: {
        default: 5,
        limit: 10
      }
    };

    const res = mapResources(au, auType, true, comp);
    expect(res).toHaveProperty("scheduler.resources.requests.cpu");
    expect(res.scheduler.resources.requests.cpu).toBe("500m");

    expect(res).toHaveProperty("scheduler.resources.requests.memory");
    expect(res.scheduler.resources.requests.memory).toBe("1920Mi");
  });

  test("mapResources correctly maps values with extras", () => {
    const au = {
      cpu: 100,
      memory: 384
    };

    const auType = "default";

    const comp = {
      name: "webserver",
      au: {
        default: 5,
        limit: 10
      },
      extra: [
        {
          name: "replicas",
          default: 1,
          limit: 10
        }
      ]
    };

    const res = mapResources(au, auType, true, comp);
    expect(res).toHaveProperty("webserver.replicas");
    expect(res.webserver.replicas).toBe(1);
  });

  test("mapResources correctly maps requests if specified", () => {
    const au = {
      cpu: 100,
      memory: 384
    };

    const auType = "default";

    const comp = {
      name: "webserver",
      au: {
        default: 5,
        limit: 10,
        request: 0.1
      }
    };

    const res = mapResources(au, auType, true, comp);
    expect(res.webserver.resources.requests.cpu).toBe("10m");
    expect(res.webserver.resources.requests.memory).toBe("39Mi");
    expect(res.webserver.resources.limits.cpu).toBe("500m");
    expect(res.webserver.resources.limits.memory).toBe("1920Mi");
  });
});

describe("arrayOfKeyValueToObject", () => {
  test("correctly transforms array to object", () => {
    // Create a test array.
    const arr = [
      { key: "AIRFLOW_HOME", value: "/tmp" },
      { key: "SCHEDULER_HEARTBEAT", value: "5" }
    ];

    // Run the transformation.
    const obj = arrayOfKeyValueToObject(arr);

    // Test for object keys and values.
    expect(obj).toHaveProperty("AIRFLOW_HOME", "/tmp");
    expect(obj).toHaveProperty("SCHEDULER_HEARTBEAT", "5");
  });

  test("correctly handles an undefined environment list", () => {
    // Run the transformation.
    const obj = arrayOfKeyValueToObject();
    expect(obj).toEqual({});
  });
});

describe("envObjectToArary", () => {
  test("correctly transforms object to array", () => {
    // Create a test object.
    const obj = {
      AIRFLOW_HOME: "/tmp",
      SCHEDULER_HEARTBEAT: "5"
    };

    // Run the transformation.
    const arr = objectToArrayOfKeyValue(obj);

    expect(arr.length).toBe(2);
    expect(arr[0]).toHaveProperty("key", "AIRFLOW_HOME");
    expect(arr[0]).toHaveProperty("value", "/tmp");
    expect(arr[1]).toHaveProperty("key", "SCHEDULER_HEARTBEAT");
    expect(arr[1]).toHaveProperty("value", "5");
  });

  test("correctly handles an undefined environment list", () => {
    // Run the transformation.
    const arr = objectToArrayOfKeyValue();
    expect(arr).toEqual([]);
  });
});

describe("mapPropertiesToDeployment", () => {
  test("correctly creates a new object with new keys", () => {
    // Create a test object.
    const email = casual.email;

    const obj = {
      [DEPLOYMENT_PROPERTY_EXTRA_AU]: 10,
      [DEPLOYMENT_PROPERTY_COMPONENT_VERSION]: "10.0.1",
      [DEPLOYMENT_PROPERTY_ALERT_EMAILS]: JSON.stringify([email])
    };

    // Run the transformation.
    const renamed = mapPropertiesToDeployment(obj);

    expect(renamed.extraAu).toEqual(obj[DEPLOYMENT_PROPERTY_EXTRA_AU]);
    expect(renamed.airflowVersion).toEqual(
      obj[DEPLOYMENT_PROPERTY_COMPONENT_VERSION]
    );

    expect(renamed.alertEmails).toHaveProperty("set");
    expect(renamed.alertEmails.set).toHaveLength(1);
    expect(renamed.alertEmails.set[0]).toEqual(email);
  });

  test("correctly handles empty values", () => {
    // Create a test object.
    const obj = {
      [DEPLOYMENT_PROPERTY_EXTRA_AU]: 0,
      [DEPLOYMENT_PROPERTY_COMPONENT_VERSION]: "",
      [DEPLOYMENT_PROPERTY_ALERT_EMAILS]: []
    };

    // Run the transformation.
    const renamed = mapPropertiesToDeployment(obj);

    expect(renamed.extraAu).toEqual(obj[DEPLOYMENT_PROPERTY_EXTRA_AU]);
    expect(renamed.airflowVersion).toBeUndefined();

    expect(renamed.alertEmails).toHaveProperty("set");
    expect(renamed.alertEmails.set).toHaveLength(0);
  });
});

describe("mapDeploymentToProperties", () => {
  test("correctly creates a new object with legacy keys", () => {
    // Create a test object.
    const obj = {
      extraAu: 10,
      airflowVersion: "10.0.1",
      alertEmails: [casual.email]
    };

    // Run the transformation.
    const renamed = mapDeploymentToProperties(obj);

    expect(renamed[DEPLOYMENT_PROPERTY_EXTRA_AU]).toEqual(obj.extraAu);
    expect(renamed[DEPLOYMENT_PROPERTY_COMPONENT_VERSION]).toEqual(
      obj.airflowVersion
    );
    expect(renamed[DEPLOYMENT_PROPERTY_ALERT_EMAILS]).toEqual(obj.alertEmails);
  });
});

describe("findLatestTag", () => {
  test("correctly determines the latest tag from list", () => {
    const tags = ["deploy-1", "deploy-3", "deploy-2", "somethingelse"];
    const latest = findLatestTag(tags);
    expect(latest).toBe("deploy-3");
  });

  test("correctly sorts tags", () => {
    const tags = ["deploy-1", "deploy-3", "deploy-2", "deploy-10", "deploy-9"];
    const latest = findLatestTag(tags);
    expect(latest).toBe("deploy-10");
  });
});

describe("generateNextTag", () => {
  test("correctly generates the next tag", () => {
    const latest = "deploy-3";
    const next = generateNextTag(latest);
    expect(next).toBe("deploy-4");
  });

  test("returns default value if latest is empty", () => {
    const latest = undefined;
    const next = generateNextTag(latest);
    expect(next).toBe(generateDefaultTag());
  });
});

describe("deploymentOverrides", () => {
  test("adds resource units to numeric inputs", () => {
    const deployment = {
      config: {
        scheduler: {
          resources: {
            limits: {
              cpu: 500,
              memory: 1920
            }
          }
        },
        webserver: {
          resources: {
            requests: {
              cpu: 100,
              memory: 384
            }
          }
        },
        workers: {
          replicas: 1
        }
      }
    };

    const res = deploymentOverrides(deployment);
    expect(res.scheduler.resources.limits.cpu).toEqual("500m");
    expect(res.scheduler.resources.limits.memory).toEqual("1920Mi");
    expect(res.webserver.resources.requests.cpu).toEqual("100m");
    expect(res.webserver.resources.requests.memory).toEqual("384Mi");
    expect(res.workers.replicas).toEqual(1);
  });
});

describe("mapCustomEnvironmentVariables", () => {
  test("correctly maps an input array of environment variables", () => {
    const deployment = { releaseName: casual.word };
    const envs = [
      { key: "AIRFLOW_HOME", value: "/tmp" },
      { key: "SCHEDULER_HEARTBEAT", value: "5" }
    ];
    const env = mapCustomEnvironmentVariables(deployment, envs);
    expect(env).toHaveProperty("secret");
    expect(env.secret).toHaveLength(2);
    expect(env.secret[0]).toHaveProperty("envName", envs[0].key);
    expect(env.secret[0]).toHaveProperty(
      "secretName",
      expect.stringContaining(deployment.releaseName)
    );
    expect(env.secret[0]).toHaveProperty("secretKey", envs[0].key);
  });
});

describe("platform", () => {
  const deployment = {
    releaseName: casual.word,
    workspace: { id: casual.uuid }
  };
  const { releaseName: platformReleaseName } = config.get("helm");
  test("returns labels for v0.11.0 and above", () => {
    const platformConfig = platform(deployment);
    expect(platformConfig).toHaveProperty(
      "labels.platform",
      platformReleaseName
    );
    expect(platformConfig).toHaveProperty(
      "labels.workspace",
      deployment.workspace.id
    );
  });
  test("returns platform for less than v0.11.0", () => {
    const platformConfig = platform(deployment);
    expect(platformConfig).toHaveProperty(
      "platform.release",
      platformReleaseName
    );
    expect(platformConfig).toHaveProperty(
      "platform.workspace",
      deployment.workspace.id
    );
  });
});

describe("airflowImageTag", () => {
  test("returns labels for v0.11.0 and above", () => {
    const version = "0.10.3";
    const distro = "buster";
    const tag = airflowImageTag(version, distro);
    expect(tag).toBe("0.10.3-buster");
  });
});

describe("airflowImageForVersion", () => {
  test("returns correct image", () => {
    const version = "1.10.5";
    const image = airflowImageForVersion(version);
    expect(image.tag).toBe("1.10.5-alpine3.10-onbuild");
  });
});
