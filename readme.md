# Postman Monitor with Prometheus

Purpose and description of this project

Goals:

- Turn Postman into a continuous monitoring tool
- Export Postman/Newman data into Prometheus

Use cases & key features:

- Monitoring of APIs and websites

Supporting technologies and libraries:

- Node.js
- [Newman](https://github.com/postmanlabs/newman)

![](https://img.shields.io/github/license/benc-uk/postman-prometheus)
![](https://img.shields.io/github/last-commit/benc-uk/postman-prometheus)
![](https://img.shields.io/github/release/benc-uk/postman-prometheus)
![](https://img.shields.io/github/checks-status/benc-uk/postman-prometheus/main)

# Using

```
$ make

help                 This help message 😁
run                  Run locally (requires Node.js) 🏃‍
image                Build container image from Dockerfile 🔨
lint-fix             Lint & format, will try to fix errors and modify code 📜
lint                 Lint & format, will not fix but sets exit code on error 🔎
push                 Push container image to registry 📤
deploy               Deploy to Kubernetes 🚀
undeploy             Remove from Kubernetes 💀
```

# Example

![](https://user-images.githubusercontent.com/14982936/111822625-eec47580-88db-11eb-9dfd-273f82e3c8dc.png)
