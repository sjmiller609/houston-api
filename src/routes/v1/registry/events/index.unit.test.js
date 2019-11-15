import router from "./index";
import * as postExports from "./post";
import { prisma } from "generated/client";
import casual from "casual";
import request from "supertest";
import express from "express";
import nock from "nock";
import { DOCKER_REGISTRY_CONTENT_TYPE } from "constants";

jest.mock("generated/client", () => {
  return {
    __esModule: true,
    prisma: jest.fn().mockName("MockPrisma")
  };
});

// Create test application.
const app = express().use(router);

describe("POST /registry-events", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("registry events are mapped to a deployment upgrade", async () => {
    prisma.deployment = jest
      .fn()
      .mockName("deployment")
      .mockReturnValue({
        config() {
          return {};
        }
      });
    prisma.updateDeployment = jest
      .fn()
      .mockName("updateDeployment")
      .mockReturnValue({});

    const labels = Symbol(),
      env = Symbol(),
      digest =
        "sha256:907b4a633d31872f7fc9b4cb22998b9de4c25f8cc8f08529ca56c2ace698e541";

    const extractImageMetadata = jest
      .spyOn(postExports, "extractImageMetadata")
      .mockImplementation(() => ({ labels, env }));

    prisma.upsertDockerImage = jest
      .fn()
      .mockName("upsertDockerImage")
      .mockReturnValue({});

    const res = await request(app)
      .post("/")
      .set("Content-Type", DOCKER_REGISTRY_CONTENT_TYPE)
      .send({
        events: [
          {
            id: casual.uuid,
            action: "push",
            target: {
              repository: "cosmic-dust-1234/airflow",
              tag: "cli-1",
              digest: digest
            },
            request: {
              host: casual.domain
            }
          }
        ]
      });

    const name = "cosmic-dust-1234/airflow:cli-1";

    expect(prisma.deployment).toHaveBeenCalledTimes(1);
    expect(prisma.updateDeployment).toHaveBeenCalledTimes(1);
    expect(extractImageMetadata).toHaveBeenCalledTimes(1);
    expect(prisma.upsertDockerImage).toHaveBeenCalledTimes(1);
    expect(prisma.upsertDockerImage).toHaveBeenCalledWith({
      where: { name },
      update: { labels, env, digest },
      create: {
        name,
        labels,
        env,
        digest,
        deployment: { connect: { releaseName: "cosmic-dust-1234" } },
        tag: "cli-1"
      }
    });
    expect(res.statusCode).toBe(200);
  });

  test("skip if irrelevent event is sent", async () => {
    const res = await request(app)
      .post("/")
      .send({
        events: [
          {
            id: casual.uuid,
            action: "push",
            target: {
              repository: "cosmic-dust-1234/airflow",
              tag: "latest"
            },
            request: {
              host: casual.domain
            }
          }
        ]
      });

    expect(prisma.deployment).toHaveBeenCalledTimes(0);
    expect(prisma.updateDeployment).toHaveBeenCalledTimes(0);
    expect(res.statusCode).toBe(200);
  });

  test("skip if non-deployment event is sent", async () => {
    // Set up our spies.
    const res = await request(app)
      .post("/")
      .send({
        events: [
          {
            id: casual.uuid,
            action: "push",
            target: {
              repository: "base-images/airflow",
              tag: "0.10.2-1.10.5"
            },
            request: {
              host: casual.domain
            }
          }
        ]
      });

    expect(prisma.deployment).toHaveBeenCalledTimes(0);
    expect(prisma.updateDeployment).toHaveBeenCalledTimes(0);
    expect(res.statusCode).toBe(200);
  });
});

describe("extractImageMetadata", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  const event = {
    action: "push",
    actor: {},
    id: "4171805b-43f8-4f98-acbc-923db2a6c183",
    request: {
      addr: "172.17.0.1:44554",
      host: "localhost:5000",
      id: "389735b8-842c-407e-9ac9-ff51d904505c",
      method: "PUT",
      useragent:
        "docker/19.03.3 go/go1.12.10 git-commit/a872fc2 kernel/4.14.131-linuxkit os/linux arch/amd64 UpstreamClient(Docker-Client/18.09.1 (darwin))"
    },
    source: {
      addr: "509d84c15f87:5001",
      instanceID: "5a935f4c-180a-4d14-b0fc-7e57c475778d"
    },
    target: {
      digest:
        "sha256:907b4a633d31872f7fc9b4cb22998b9de4c25f8cc8f08529ca56c2ace698e541",
      length: 2402,
      mediaType: "application/vnd.docker.distribution.manifest.v2+json",
      repository: "telescopic-sun-2787/airflow",
      size: 2402,
      tag: "cli-1",
      url:
        "http://localhost:5000/v2/telescopic-sun-2787/airflow/manifests/sha256:907b4a633d31872f7fc9b4cb22998b9de4c25f8cc8f08529ca56c2ace698e541"
    },
    timestamp: "2019-10-27T15:28:05.9491821Z"
  };

  const manifestResponse = {
    config: {
      digest:
        "sha256:eb7dc89de609bc3b6e5af651bfb6c7879e33c6b3a9ab09cc0a0ec0c7d050a5b6",
      mediaType: "application/vnd.docker.container.image.v1+json",
      size: 10621
    },
    layers: [
      /*...*/
    ]
  };

  const configBlobResponse = {
    architecture: "amd64",
    config: {
      Hostname: "",
      Domainname: "",
      User: "",
      AttachStdin: false,
      AttachStdout: false,
      AttachStderr: false,
      ExposedPorts: { "5555/tcp": {}, "8080/tcp": {}, "8793/tcp": {} },
      Tty: false,
      OpenStdin: false,
      StdinOnce: false,
      Env: [
        "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        "AIRFLOW_REPOSITORY=https://github.com/astronomer/airflow",
        "AIRFLOW_MODULE=git+https://github.com/astronomer/airflow@1.10.5-1#egg=apache-airflow[all, statsd, elasticsearch]",
        "AIRFLOW_HOME=/usr/local/airflow",
        "PYMSSQL_BUILD_WITH_BUNDLED_FREETDS=1",
        "PYTHONPATH=/usr/local/airflow",
        "AIRFLOW_GPL_UNIDECODE=True",
        "ASTRONOMER_USER=astro",
        "ASTRONOMER_GROUP=astro",
        "GUNICORN_CMD_ARGS=--preload"
      ],
      Cmd: null,
      ArgsEscaped: true,
      Image:
        "sha256:bc3917a3d61fc9cf2af44ddb6a07556e6ea4ebae4ef6331663e569df14491d17",
      Volumes: null,
      WorkingDir: "/usr/local/airflow",
      Entrypoint: ["tini", "--", "/entrypoint"],
      OnBuild: null,
      Labels: {
        "io.astronomer.docker": "true",
        "io.astronomer.docker.airflow.version": "1.10.5",
        "io.astronomer.docker.build.number": "1403",
        "io.astronomer.docker.component": "airflow",
        "io.astronomer.docker.module": "airflow",
        maintainer: "Astronomer \u003chumans@astronomer.io\u003e"
      }
    },
    container_config: {
      /*...*/
    },
    history: [
      /*...*/
    ],
    os: "linux",
    rootfs: {
      /* ... */
    }
  };

  test("ignores unknown manifest types", async () => {
    // Submit a clone of the event with different media type
    const ev = JSON.parse(JSON.stringify(event));
    ev.target.mediaType =
      "application/vnd.docker.distribution.manifest.v1+json";

    const scope = nock("http://localhost:5000/")
      .get(/.*/)
      .replyWithError("should not be called");

    await expect(postExports.extractImageMetadata(ev)).resolves.toBeUndefined();

    // Should not have made any http requests
    expect(scope.isDone()).toBe(false);
  });

  test("fetches config blob", async () => {
    const scope = nock("http://localhost:5000/")
      .get(`/v2/telescopic-sun-2787/airflow/manifests/${event.target.digest}`)
      .reply(200, manifestResponse)
      .get(
        `/v2/telescopic-sun-2787/airflow/blobs/${
          manifestResponse.config.digest
        }`
      )
      .reply(200, configBlobResponse);

    await expect(postExports.extractImageMetadata(event)).resolves.toEqual({
      digest:
        "sha256:eb7dc89de609bc3b6e5af651bfb6c7879e33c6b3a9ab09cc0a0ec0c7d050a5b6",
      env: [
        "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        "AIRFLOW_REPOSITORY=https://github.com/astronomer/airflow",
        "AIRFLOW_MODULE=git+https://github.com/astronomer/airflow@1.10.5-1#egg=apache-airflow[all, statsd, elasticsearch]",
        "AIRFLOW_HOME=/usr/local/airflow",
        "PYMSSQL_BUILD_WITH_BUNDLED_FREETDS=1",
        "PYTHONPATH=/usr/local/airflow",
        "AIRFLOW_GPL_UNIDECODE=True",
        "ASTRONOMER_USER=astro",
        "ASTRONOMER_GROUP=astro",
        "GUNICORN_CMD_ARGS=--preload"
      ],
      labels: {
        "io.astronomer.docker": "true",
        "io.astronomer.docker.airflow.version": "1.10.5",
        "io.astronomer.docker.build.number": "1403",
        "io.astronomer.docker.component": "airflow",
        "io.astronomer.docker.module": "airflow",
        maintainer: "Astronomer <humans@astronomer.io>"
      }
    });

    expect(scope.isDone()).toBeTruthy();
  });
});
