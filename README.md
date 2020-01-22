# Houston API

[![Maintainability](https://api.codeclimate.com/v1/badges/fa7e3822ab433568f524/maintainability)](https://codeclimate.com/github/astronomer/houston-api-2/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/fa7e3822ab433568f524/test_coverage)](https://codeclimate.com/github/astronomer/houston-api-2/test_coverage)

## Description

Houston is the API for the [Astronomer Platform](https://github.com/astronomer/astronomer). It is primarily a [GraphQL](https://graphql.org) server built with [Apollo Server 2](https://www.apollographql.com) and [Prisma](https://www.prisma.io/docs/). It also supports several RESTful endpoints using the same [Express](https://github.com/expressjs/express) server that Apollo is using. These endpoints are primarily used for integrating with external authentication, [Alertmanager](https://prometheus.io/docs/alerting/alertmanager/), [Docker Registry](https://github.com/docker/distribution/blob/master/docs/spec/api.md) and other external dependencies. This is the second iteration of this API. This version was built to support the same external API, and is just an internal
re-implementation.

## Database

Houston leverages [Prisma](https://www.prisma.io/docs/) as a [GraphQL](https://graphql.org) backend on top of Postgres. The Prisma service sits between Houston and Postgres and exposes a secure CRUD API on top of the [datamodel](https://github.com/astronomer/houston-api-2/blob/master/database/datamodel.graphql) defined in this project.

## Configuration

Houston can be configured via YAML files under `./config`, and can be overridden via environment variables, which are defined in `/config/custom-environment-variables.yaml`. To add or override any variables locally, create a `.env` file in the project directory.

## Structure

All source code is nested under `src`. This directory contains:

* [`lib`](https://github.com/astronomer/houston-api-2/tree/master/src/lib) contains all shared, library code. This directory is [listed as a root for the babel module loader](https://github.com/astronomer/houston-api-2/blob/master/.babelrc). All modules defined under this directory can be imported directly, rather than specifying a relative path.
* [`resolvers`](https://github.com/astronomer/houston-api-2/tree/master/src/resolvers) contains all the Queries, Mutations and Types for the GraphQL API.
* [`routes`](https://github.com/astronomer/houston-api-2/tree/master/src/routes) contains all RESTful route definitions.
* [`index.js`](https://github.com/astronomer/houston-api-2/blob/master/src/index.js) is the entrypoint for the application.
* [`schema.graphl`](https://github.com/astronomer/houston-api-2/blob/master/src/schema.graphql) contains the entire application schema.

## Schema
In general, Queries and Mutations should be granular enough, such that they can be protected using the `@auth` directive. There may be cases where a user can list a group of resources, but maybe not read or update the details of that resource. For instance maybe a user can _list_ deployments, but they can not _get_ or _update_ those deployments. In this case, we would want to support a `deployments` query, as well as a singular `deployment` query that returns a single instance of a `Deployment`. Each query could then require a different permission.


### Naming Conventions
* Queries and Subscriptions should have the form `scopeObject`, like `workspaceUsers` or `workspaceDeployments`. Sometimes we'll have a query _and_ subscription that are used together, like we do for the deployment logs. In these cases, the query and subscription should have the same name.
* Mutations should have the form `scopeObjectVerb`, like `workspaceUserInvite` or `workspaceDeploymentCreate`.

## Scopes
Houston uses the concept of scopes as part of its RBAC system, which is tied to the application schema. There are currently three scopes - `System`, `Workspace` and `Deployment`. These are the bondaries that a `RoleBinding` will apply to. `System` is used to denote operations that apply at the Astronomer Platform layer and generally have global implications. The `Workspace` scope groups users and deployments together. In cloud mode, this is usually a company or organization. In enterprise mode, this is usually a team within a company or organization. The `Deployment` scope denotes operations that affect a single `Deployment`, which is always nested under a `Workspace`.

## Authentication

Houston supports multiple authentication methods. Currently it supports the built-in username/password method, as well as [Google OAuth](https://developers.google.com/identity/protocols/OAuth2), as well as [Auth0 OAuth](https://auth0.com). By default, the local authentication method is enabled, as well as a default Auth0 account. This can be overridden with a custom configuration to override the [default values under the `auth` section](https://github.com/astronomer/houston-api-2/blob/master/config/default.yaml).

## Authorization

Houston currently defines several default role values in it's datamodel [here](https://github.com/astronomer/houston-api-2/blob/master/database/datamodel.graphql). These values are backed by a configurable permission mapping via a config file. The default permission mappings are defined [here](https://github.com/astronomer/houston-api-2/blob/master/config/default.yaml). These permissions are currently enforced using a [GraphQL
Directive](https://www.apollographql.com/docs/graphql-tools/schema-directives.html).

## Development

Houston is written in ES6 and beyond, and it's currently built with [Babel](https://babeljs.io). The easiest way to run the project locally is to first run `docker-compose up`, or `docker-compose up -d` to detach and run the containers in the background, freeing up your terminal. This will start the postgres database, as well as the prisma service. From here you can run `npm install`, then `npm start` to start the project locally, connecting to the previously started data stack. This uses [Nodemon](https://github.com/remy/nodemon) and will restart when any source files change. The only exception is `./database/datamodel.graphql`. Changes to this file require you to restart, triggering a `prisma deploy` and `prisma generate`. We could probably automate that process on change as well. Houston could also be added to the docker-compose services, but it's easier to interpret the logs when it's on its own. Houston will start the [Playground](https://github.com/prisma/graphql-playground) by default, but it's also possible to start a playground that will expose the application API, as well as the prisma API. To start this on port 3000, just run `graphql playground`, or send it to the background with `graphql playground &`.

## Testing

Houston is currently using [Jest](https://jestjs.io) for running tests. Typically test files will live near the unit being tested and be named similarly with `.unit.test.js` as its extension. Jest can be ran as a one-off or can be run in watch mode. Both modes allow you to specify a regex path to limit what tests are running. `npm run test` will run all tests once and report back. `npm run test -- src/resolvers/create-user --watch` will run in watch mode, and only for the tests for the `create-user` resolver.

## Developing locally, in Kubernetes, with Telepresence

[Telepresence](https://telepresence.io) is a tool which
allows you to run a program locally, but as if it was in the cluster.
[Installation instructions](https://www.telepresence.io/reference/install)
are available with most systems having it in their package manager.
(brew / apt install telepresence)


Note, this will use the secrets and environment variables
from the deployment in kubernetes.
The config will be taken from the local filesystem.
To use the cluster configs, see below.

You will need to make some edits to make Houston work locally with telepresence.

#### Edit the database conection string to remove the "svc.cluster.local"

```bash
kubectl get secret -n tester astronomer-bootstrap -o yaml

echo -n "base64-string" | base64 -d   # or -D if on mac
echo -n "postgres://postgres:<password>@<postgres-service>.<namespace>:5432" | base64

kubectl edit secret -n tester astronomer-bootstrap
```

#### Edit the CORS policy in config/default.yaml

Near the top of `config/default.yaml`
edit

```yaml
cors:
  allowedOrigins: ["https://app.<your-domain>"]
```

#### Run telepresence and houston

With the edits in place and a deployed houston-api running in kubernetes

```bash
telepresence \
  --namespace tester \
  --swap-deployment tester-houston \
  --run-shell

# ... deploys proxy, prints output ...

# once it comes online, you can get your normal shell by running...
bash

# mount secret volumes
./bin/volumes.sh

# start houston locally
npm start
```

You will now have a locally running houston
as if it was in kubernetes.

#### Configuration files

Running Houston under telepresence will take changes
from your local filesystem.
You can also use the configuration from within the cluster.
In the previous section, add an argument to the volumes script:

```bash
./scripts/volumes.sh production
```

Any argument will cause the cluster config dir to be mounted.
This will also set the NODE_ENV to the argument value.
You can set the NODE_ENV yourself to select a different, local config value
if you do not want to use the cluster versions.
Additionally, both methods support ENV_VAR overrides in wither mode.


## Testing Airflow Chart Upgrades in Kubernetes

Sometimes it's useful to manually take over the role of commander, in order to test other components, like the airflow chart. Since commander requires the chart to live in a remote repository, it's difficult to quickly iterate on changes to the chart locally. One way to test this type of scenario is to disable commander and enable logging of the helm values instead. This can be done by setting configuration `commander.enabled: false` and `deployments.logHelmValues: true`. These can be overridden via environment variables.

Create a new deployment via the UI or CLI, then grab the values that Houston logs out. You can then use these values to pass to a `helm install` manually. Ex: `helm install -f values.yaml -n <release-name> --namespace <namespace>`.

## Connecting locally to a production Prometheus

* Fetch credentials for the running cluster (i.e. `gcloud container clusters get-credentials ${CLUSTER_NAME} --zone ${ZONE} --project ${PROJECT}`)
* Switch to namespace (i.e. `kubens ${NAMESPACE}`), You may need to `brew install kubectx`.
* Port forward to a production Prometheus (i.e. `kubectl port-forward svc/${SERVICE_NAME} 9090:9090`)
* Hard code to read from a production Airflow deployment's metrics stream, uncomment/change 25 of `/src/resolvers/subscription/metrics/index.js`

## Useful Commands

* `npm start` starts the develpment server. Restarts automatically with nodemon.
* `npm run build` builds with babel and place output into `./dist`.
* `npm run serve` starts the production server from built files under `./dist`.
* `npm run test` runs tests using `jest`.
* `npm run test -- --watch` runs tests in watch mode.
* `npm run test -- src/resolvers/create-user --watch` runs a subset of tests in watch mode.
* `npm run coverage` runs tests and outputs a coverage report to `./coverage`.
* `npm run lint` runs eslint.
* `npm run playground` starts a single playground for application as well as prisma CRUD.
* `docker-compose up` starts a postgres container and the prisma service container.
