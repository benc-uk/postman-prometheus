# Postman Monitor with Prometheus

This project provides a small Node.js based server which will run a Postman collection continuously on regular interval. It uses the Newman library that Postman provides, and exposes various HTTP and request metrics and stats in Prometheus exposition format so they can be scraped by Prometheus. This allows you to proactively monitor any Postman collection you wish, from wherever you wish.

You can use this to monitor the health and performance of web sites and REST APIs, and by using test assertions (see below) you can validate the contents returned, status codes, headers etc. Even chain requests together extracting variables from one request to use with another.

By default the server listens on port 8080 and provides metrics at the standard `/metrics` endpoint (this is configurable). The collection you want to run can be fetched by the runner at startup from a URL you supply, or you can build the runner container with the collection file copied into the image.

Configuration can be fetched from local files (typically bundled inside the container) or from remote URL sources. This configuration is a Postman collection file (as a JSON export) and **optionally** a Postman environment file (also in JSON)

The server is containerised and published publicly as a container image at `ghcr.io/benc-uk/postman-prometheus`

Kubernetes manifests for deployment are also provided.

Goals:

- Turn Postman into a continuous monitoring tool
- Export Postman/Newman data into Prometheus

Use cases & key features:

- Monitoring of APIs and websites
- Host your own monitoring with Kubernetes or anywhere you need
- Go beyond simple single HTTP checks, using Postman's [collection feature](https://learning.postman.com/docs/running-collections/intro-to-collection-runs/) and [test assertions](https://learning.postman.com/docs/writing-scripts/script-references/test-examples/) for checking and chaining
- Validate HTML or API responses, payloads and even build end to end journeys

![](https://img.shields.io/github/license/benc-uk/postman-prometheus)
![](https://img.shields.io/github/last-commit/benc-uk/postman-prometheus)
![](https://img.shields.io/github/release/benc-uk/postman-prometheus)
![](https://img.shields.io/github/checks-status/benc-uk/postman-prometheus/main)

# 🖼️ Example

This is a screenshot of the provided Grafana dashboard

The dashboard can be found in the [grafana directory](https://github.com/benc-uk/postman-prometheus/tree/main/grafana) as a JSON file which you can import.

![screen shot of dashboard](https://user-images.githubusercontent.com/14982936/111913204-fd8a6400-8a64-11eb-95c1-a40f4828d05f.png)

# ⚙️ Configuration

| Environmental Variable | Purpose                                                          | Default           |
| ---------------------- | ---------------------------------------------------------------- | ----------------- |
| PORT                   | Port the server listens on                                       | 8080              |
| COLLECTION_FILE        | Path to Postman collection file to load and use                  | ./collection.json |
| COLLECTION_URL         | Load from Postman collection from URL, overrides COLLECTION_FILE | _none_            |
| REFRESH_INTERVAL       | How frequently fetch and refresh remote collection/env files     | 300               |
| RUN_INTERVAL           | How frequently to run the collection, in seconds                 | 30                |
| RUN_ITERATIONS         | How many iterations of the collection to run                     | 1                 |
| ENABLE_BAIL            | Stops the run when a test case or request fails                  | false             |
| ENABLE_REQUEST_METRICS | Disable the per-request metrics if you wish                      | true              |
| ENVIRONMENT_FILE       | Path to a Postman environment file                               | _none_            |
| ENVIRONMENT_URL        | Load a Postman environment from URL, overrides ENVIRONMENT_FILE  | _none_            |
| POSTMAN\_{varname}     | Environment vars to pass to running the collection               | _none_            |
| METRICS_URL_PATH       | URL path to serve the metrics from, must start with slash        | /metrics          |
| STATUS_ENABLED         | Enable/disable the status endpoint.                              | true              |
| ENABLE_DEBUG_FILE      | Enable/disable the file debug.tmp.json which contains all execution summary | false |
> NOTE: When both `COLLECTION_URL` and `COLLECTION_FILE` are set, then `COLLECTION_URL` will take precedence. Likewise for `ENVIRONMENT_FILE` and `ENVIRONMENT_URL`. Meaning these configuration settings are effectively mutually exclusive

## Note on Postman variables

Postman/Newman can [accept variables a number of ways](https://learning.postman.com/docs/sending-requests/variables/) with this runner you supply values for any variables your scripts reference in two ways:

- Environments file, this is a JSON file created by defining an environment in Postman and [exporting as JSON](https://learning.postman.com/docs/getting-started/importing-and-exporting-data/#exporting-environments)
- Using special `POSTMAN_{varname}` environment vars, set as regular OS environment vars (therefor settable at runtime from Docker and Kubernetes). The prefix `POSTMAN_` is required and stripped off, leaving the name of the variable to set when running the collection, e.g. if your Postman request referenced a variable `{{myvar}}` you can set it using `POSTMAN_myvar=foo`

# 📃 Repo Contents

📁 `src` - Source of the Node.js runner which wraps Newman  
📁 `samples` - Example Postman collections for monitoring  
📁 `grafana` - Example Grafana dashboard which can be imported  
📁 `deploy` - Deployment to Kubernetes, plus Helm samples for alerting  
📁 `build` - Dockerfile mostly  
📁 `scripts` - Some bash scripts

# 🔨 Using

Just about everything you need to do with this project has been put into make

```txt
$ make

help                 💬 This help message
run                  🥈 Run locally (requires Node.js) ‍
image                🔨 Build container image from Dockerfile
lint-fix             📜 Lint & format, will try to fix errors and modify code
lint                 🔎 Lint & format, will not fix but sets exit code on error
push                 📤 Push container image to registry
clean                🧹 Clean up local repo
deploy               🚀 Deploy to Kubernetes
undeploy             💀 Remove from Kubernetes
```

The `deploy` target provides a lightweight "Helm-less" way to deploy to Kubernetes, using envsubst, makefile variables and deploy/deployment.yaml as a template.
Before running `make deploy` check the `DEPLOY_` variables in the makefile, then either edit or override these

# 🌐 Other Endpoints

As well as exposing metrics for scraping, the server also exposes a small status API at `/status`, which will show details of the configuration, the loaded collection and some runtime statistics in JSON form. In addition the endpoint `/health` will return an HTTP 200

# 📊 Exported Metrics

Below is a dump of all the metrics the server will export.

> **💬 Note**. There could be MANY per-request metrics, if running a collection with a large number of requests and a large number of iterations. You have been warned!

```txt
# ==========================================================
# Lifetime metrics for the whole life of the monitor server
# ==========================================================

# TYPE postman_lifetime_runs_total counter
postman_lifetime_runs_total{collection="Example"} 69

# TYPE postman_lifetime_iterations_total counter
postman_lifetime_iterations_total{collection="Example"} 138

# TYPE postman_lifetime_requests_total counter
postman_lifetime_requests_total{collection="Example"} 276

# ==========================================================
# Metrics aggregated for the whole collection
# ==========================================================

# TYPE postman_stats_iterations_total gauge
postman_stats_iterations_total{collection="Example"} 2

# TYPE postman_stats_iterations_failed gauge
postman_stats_iterations_failed{collection="Example"} 0

# TYPE postman_stats_requests_total gauge
postman_stats_requests_total{collection="Example"} 4

# TYPE postman_stats_requests_failed gauge
postman_stats_requests_failed{collection="Example"} 0

# TYPE postman_stats_tests_total gauge
postman_stats_tests_total{collection="Example"} 4

# TYPE postman_stats_tests_failed gauge
postman_stats_tests_failed{collection="Example"} 0

# TYPE postman_stats_test_scripts_total gauge
postman_stats_test_scripts_total{collection="Example"} 4

# TYPE postman_stats_test_scripts_failed gauge
postman_stats_test_scripts_failed{collection="Example"} 0

# TYPE postman_stats_assertions_total gauge
postman_stats_assertions_total{collection="Example"} 8

# TYPE postman_stats_assertions_failed gauge
postman_stats_assertions_failed{collection="Example"} 2

# TYPE postman_stats_transfered_bytes_total gauge
postman_stats_transfered_bytes_total{collection="Example"} 43750

# TYPE postman_stats_resp_avg gauge
postman_stats_resp_avg{collection="Example"} 40.25

# TYPE postman_stats_resp_min gauge
postman_stats_resp_min{collection="Example"} 17

# TYPE postman_stats_resp_max gauge
postman_stats_resp_max{collection="Example"} 107

# ==========================================================
# These metrics are per request AND per iteration
# ==========================================================

# TYPE postman_request_status_code gauge
postman_request_status_code{request_name="Some Example Request",iteration="0",collection="Example"} 200

# TYPE postman_request_resp_time gauge
postman_request_resp_time{request_name="Some Example Request",iteration="0",collection="Example"} 19

# TYPE postman_request_resp_size gauge
postman_request_resp_size{request_name="Some Example Request",iteration="0",collection="Example"} 8684

# TYPE postman_request_status_ok gauge
postman_request_status_ok{request_name="Some Example Request",iteration="0",collection="Example"} 1

# TYPE postman_request_failed_assertions gauge
postman_request_failed_assertions{request_name="Some Example Request",iteration="0",collection="Example"} 0

# TYPE postman_request_total_assertions gauge
postman_request_total_assertions{request_name="Some Example Request",iteration="0",collection="Example"} 3
```
