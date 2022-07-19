IMAGE_REG ?= ghcr.io
IMAGE_REPO ?= benc-uk/postman-prometheus
IMAGE_TAG ?= latest

SRC_DIR := src
ROOT_DIR := $(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))

# Used when running locally
COLLECTION_FILE ?= $(ROOT_DIR)/samples/example.json

# Used when deploying to Kubernetes
# Override these when calling `make deploy`
DEPLOY_NAMESPACE ?= default
DEPLOY_SUFFIX ?= example
DEPLOY_ITERATIONS ?= 1
DEPLOY_INTERVAL ?= 600
DEPLOY_COLLECTION_URL ?= https://raw.githubusercontent.com/benc-uk/postman-prometheus/main/samples/example.json
DEPLOY_BAIL ?= false
DEPLOY_IMAGE := $(IMAGE_REG)/$(IMAGE_REPO):$(IMAGE_TAG)

.PHONY: help lint lint-fix image push run deploy undeploy .EXPORT_ALL_VARIABLES
.DEFAULT_GOAL := help

help: ## 💬 This help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

lint: $(SRC_DIR)/node_modules ## 🔎 Lint & format, will not fix but sets exit code on error 
	cd $(SRC_DIR); npm run lint

lint-fix: $(SRC_DIR)/node_modules ## 📜 Lint & format, will try to fix errors and modify code 
	cd $(SRC_DIR); npm run lint-fix

image: ## 📦 Build container image from Dockerfile 
	docker build . --file build/Dockerfile \
	--tag $(IMAGE_REG)/$(IMAGE_REPO):$(IMAGE_TAG)

push: ## 📤 Push container image to registry 
	docker push $(IMAGE_REG)/$(IMAGE_REPO):$(IMAGE_TAG)

run: $(SRC_DIR)/node_modules .EXPORT_ALL_VARIABLES ## 🥈 Run locally using Node.js
	cd $(SRC_DIR); npm start

clean: ## 🧹 Clean up local repo
	rm -rf src/*.tmp.*
	rm -rf src/node_modules

deploy: .EXPORT_ALL_VARIABLES ## 🚀 Deploy to Kubernetes 
	cat deploy/deployment.yaml | envsubst | kubectl apply -f -

undeploy: .EXPORT_ALL_VARIABLES ## 💀 Remove from Kubernetes 
	cat deploy/deployment.yaml | envsubst | kubectl delete -f - || true

# ==== Internal targets =====

$(SRC_DIR)/node_modules: $(SRC_DIR)/package.json
	cd $(SRC_DIR); npm install --silent
	touch -m $(SRC_DIR)/node_modules

$(SRC_DIR)/package.json: 
	@echo "package.json was modified"
