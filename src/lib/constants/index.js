export const DEPLOYMENT_AIRFLOW = "airflow";

export const DEPLOYMENT_PROPERTY_COMPONENT_VERSION = "component_version";
export const DEPLOYMENT_PROPERTY_ALERT_EMAILS = "alert_emails";
export const DEPLOYMENT_PROPERTY_EXTRA_AU = "extra_au";

export const DEPLOYMENT_STATUS_ACTIVE = "active";
export const DEPLOYMENT_STATUS_DELETING = "deleting";

export const AIRFLOW_EXECUTOR_LOCAL = "LocalExecutor";
export const AIRFLOW_EXECUTOR_CELERY = "CeleryExecutor";
export const AIRFLOW_EXECUTOR_KUBERNETES = "KubernetesExecutor";

// Set the default executor
export const AIRFLOW_EXECUTOR_DEFAULT = AIRFLOW_EXECUTOR_CELERY;

export const AIRFLOW_COMPONENT_SCHEDULER = "scheduler";
export const AIRFLOW_COMPONENT_WEBSERVER = "webserver";
export const AIRFLOW_COMPONENT_STATSD = "statsd";
export const AIRFLOW_COMPONENT_PGBOUNCER = "pgbouncer";
export const AIRFLOW_COMPONENT_WORKERS = "workers";
export const AIRFLOW_COMPONENT_FLOWER = "flower";
export const AIRFLOW_COMPONENT_REDIS = "redis";

export const USER_STATUS_ACTIVE = "active";
export const USER_STATUS_PENDING = "pending";
export const USER_STATUS_BANNED = "banned";
export const USER_STATUS_INACTIVE = "inactive";

export const USER_PROPERTY_FULL_NAME = "fullName";
export const USER_PROPERTY_AVATAR_URL = "avatarUrl";
export const USER_PROPERTY_CATEGORY_PROFILE = "profile";

export const SYSTEM_ADMIN = "SYSTEM_ADMIN";
export const SYSTEM_EDITOR = "SYSTEM_EDITOR";
export const SYSTEM_VIEWER = "SYSTEM_VIEWER";
export const WORKSPACE_ADMIN = "WORKSPACE_ADMIN";
export const WORKSPACE_EDITOR = "WORKSPACE_EDITOR";
export const WORKSPACE_VIEWER = "WORKSPACE_VIEWER";
export const DEPLOYMENT_ADMIN = "DEPLOYMENT_ADMIN";
export const DEPLOYMENT_EDITOR = "DEPLOYMENT_EDITOR";
export const DEPLOYMENT_VIEWER = "DEPLOYMENT_VIEWER";

export const ENTITY_WORKSPACE = "WORKSPACE";
export const ENTITY_DEPLOYMENT = "DEPLOYMENT";

export const DEFAULT_NEXT_IMAGE_TAG = "cli-1";

export const DOCKER_REGISTRY_CONTENT_TYPE =
  "application/vnd.docker.distribution.events.v1+json";

export const MEDIATYPE_DOCKER_MANIFEST_V2 =
  "application/vnd.docker.distribution.manifest.v2+json";
