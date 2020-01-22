# Updating Houston

This file documents any backwards-incompatible changes in Houston and
assists users migrating to a new version.

## Master

### Updated auth configuration

The auth configuration for Auth0, Google and Okta has been moved to new config
names, and `baseDomain` has been replaced with `discoveryUrl`.

**Old style**

```yaml
auth:
  auth0:
    enabled: true
    baseDomain: org.auth0.com
    clientId: $ID
  google:
    enabled: true
    clientId: $ID
  okta:
    enabled: true
    baseDomain: org.okta.com
    clientId: $ID
```

or for env vars:

```sh
AUTH__AUTH0__ENABLED=ture
AUTH__AUTH0__BASE_DOMAIN=org.auth0.com
AUTH__AUTH0__CLIENT_ID=$ID
```

**New style**

```yaml
auth:
  openidConnect:
    auth0:
      enabled: true
      discoveryUrl: https://org.auth0.com  # Note this changed name and is now a url
      clientId: $ID
    google:
      enabled: true
      clientId: $ID
    okta:
      enabled: true
      discoveryUrl: https://org.okta.com  # Note this changed name and is now a url
      clientId: $ID
```

and the env vars follow this pattern:

```sh
AUTH__OPENID_CONNECT__AUTH0__ENABLED=true
AUTH__OPENID_CONNECT__AUTH0__DISCOVERY_URL=https://org.auth0.com
AUTH__OPENID_CONNECT__AUTH0__CLIENT_ID=$ID
```
