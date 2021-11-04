# Postman Monitor with Prometheus

This project provides a small Node.js based server which will run a Postman collection continuously on regular short interval. It uses the Newman library that Postman provides, and exposes various metrics and stats in Prometheus exposition format so the can be scraped by Prometheus. This allows you to proactively monitor any Postman collection you wish, from wherever you wish

By default the server listens on port 8080 and provides metrics at the standard `/metrics` endpoint. The collection you want to run can be fetched by the runner at startup from a URL you supply, or you can build the runner container with the collection file copied into the image.

The server is containerised and published publicly at ghcr.io/benc-uk/postman-prometheus

Kubernetes manifests for deployment are also provided.

Goals:

- Turn Postman into a continuous monitoring tool
- Export Postman/Newman data into Prometheus

Use cases & key features:

- Monitoring of APIs and websites
- Go beyond simple single HTTP checks, using Postman's [collection feature](https://learning.postman.com/docs/running-collections/intro-to-collection-runs/) and [test assertions](https://learning.postman.com/docs/writing-scripts/script-references/test-examples/) for checking and chaining

![](https://img.shields.io/github/license/benc-uk/postman-prometheus)
![](https://img.shields.io/github/last-commit/benc-uk/postman-prometheus)
![](https://img.shields.io/github/release/benc-uk/postman-prometheus)
![](https://img.shields.io/github/checks-status/benc-uk/postman-prometheus/main)

# Example

This is a screenshot of the provided Grafana dashboard

The dashboard can be found in the [grafana directory](https://github.com/benc-uk/postman-prometheus/tree/main/grafana) as a JSON file which you can import.

![screen shot of dashboard](https://user-images.githubusercontent.com/14982936/111913204-fd8a6400-8a64-11eb-95c1-a40f4828d05f.png)

# Config

| Environmental Varibale | Purpose                                                          | Default           |
| ---------------------- | ---------------------------------------------------------------- | ----------------- |
| PORT                   | Port the server listens on                                       | 8080              |
| COLLECTION_FILE        | Path to Postman collection file to load and use                  | ./collection.json |
| COLLECTION_URL         | Load from Postman collection from URL, overrides COLLECTION_FILE | _none_            |
| RUN_INTERVAL           | How frequently to run the collection, in seconds                 | 30                |
| RUN_ITERATIONS         | How many iterations of the collection to run                     | 1                 |
| ENABLE_BAIL            | Stops the run when a test case or request fails                  | false             |
| ENABLE_REQUEST_METRICS | Disable the per-request metrics if you wish                      | true              |
| ENVIRONMENT_FILE       | Path to a Postman environment file                               | _none_            |
| POSTMAN\_{varname}     | Environment vars to pass to running the collection               | _none_            |

## Note on Postman variables

Postman/Newman can [accept variables a number of ways](https://learning.postman.com/docs/sending-requests/variables/) with this runner you supply values for any variables your scripts reference in two ways:

- Environments file, created by defining an environment in Postman and [exporting as JSON](https://learning.postman.com/docs/getting-started/importing-and-exporting-data/#exporting-environments)
- Using special `POSTMAN_{varname}` environment vars, set as regular OS environment vars (therefor settable at runtime from Docker and Kubernetes). The prefix `POSTMAN_` is required and stripped off, leaving the name of the variable to set when running the collection, e.g. if your Postman request referenced a variable `{{myvar}}` you can set it using `POSTMAN_myvar=foo`

# Repo Contents

📁 `src` - Source of the Node.js runner which wraps Newman  
📁 `samples` - Example Postman collections for monitoring  
📁 `grafana` - Example Grafana dashboard which can be imported  
📁 `deploy` - Deployment to Kubernetes, plus Helm samples for alerting  
📁 `build` - Dockerfile mostly  
📁 `scripts` - Some bash scripts

# Using

Just about everything you need to do with this project has been put into make

```txt
$ make

help                 💬 This help message 
run                  🥈 Run locally (requires Node.js) ‍
image                🔨 Build container image from Dockerfile 
lint-fix             📜 Lint & format, will try to fix errors and modify code 
lint                 🔎 Lint & format, will not fix but sets exit code on error 
push                 📤 Push container image to registry
deploy               🚀 Deploy to Kubernetes 
undeploy             💀 Remove from Kubernetes 
```

The `deploy` target provides a lightweight "Helm-less" way to deploy to Kubernetes, using envsubst, makefile variables and deploy/deployment.yaml as a template.
Before running `make deploy` check the `DEPLOY_` variables in the makefile, then either edit or override these

# Exported Metrics

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
