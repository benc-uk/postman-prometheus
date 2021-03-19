IMAGE_REG ?= ghcr.io
IMAGE_REPO ?= benc-uk/postman-prometheus
IMAGE_TAG ?= latest

COLLECTION_FILE ?= ./samples/my-blog.json

DEPLOY_NAMESPACE ?= default
DEPLOY_ITERATIONS ?= 2
DEPLOY_INTERVAL ?= 30
DEPLOY_COLLECTION_URL ?= https://raw.githubusercontent.com/benc-uk/postman-prometheus/main/samples/my-blog.json
DEPLOY_BAIL ?= false
DEPLOY_IMAGE := $(IMAGE_REG)/$(IMAGE_REPO):$(IMAGE_TAG)

.PHONY: help lint lint-fix image push run deploy .EXPORT_ALL_VARIABLES
.DEFAULT_GOAL := help

help:  ## This help message 😁
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

lint:  ## Lint & format, will not fix but sets exit code on error 🔎
	npm run lint

lint-fix:  ## Lint & format, will try to fix errors and modify code 📜
	npm run lint-fix

image:  ## Build container image from Dockerfiles 🔨
	docker build . --file ./Dockerfile \
	--tag $(IMAGE_REG)/$(IMAGE_REPO):$(IMAGE_TAG)

push:  ## Push container image to registry 📤
	docker push $(IMAGE_REG)/$(IMAGE_REPO):$(IMAGE_TAG)

run: .EXPORT_ALL_VARIABLES  ## Run locally 🏃‍
	npm start

deploy: .EXPORT_ALL_VARIABLES  ## Deploy to Kubernetes 🚀
	 cat deploy/deployment.yaml | envsubst | kubectl apply -f -

undeploy: .EXPORT_ALL_VARIABLES  ## Remove from Kubernetes 💀
	 cat deploy/deployment.yaml | envsubst | kubectl delete -f - || true