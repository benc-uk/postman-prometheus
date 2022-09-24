const newman = require('newman')
const express = require('express')
const fs = require('fs')
const http = require('./http.js')

let collectionFile = process.env.COLLECTION_FILE || './collection.json'
let envFile = process.env.ENVIRONMENT_FILE || ''
const collectionUrl = process.env.COLLECTION_URL || ''
const metricsUrlPath = process.env.METRICS_URL_PATH || '/metrics'
const statusEnabled = process.env.STATUS_ENABLED || 'true'
const envUrl = process.env.ENVIRONMENT_URL || ''
const port = process.env.PORT || '8080'
const refreshInterval = process.env.REFRESH_INTERVAL || '120'
const runInterval = process.env.RUN_INTERVAL || '30'
const runIterations = process.env.RUN_ITERATIONS || '1'
const enableBail = process.env.ENABLE_BAIL || 'false'
const requestMetrics = process.env.ENABLE_REQUEST_METRICS || 'true'

let collectionName = ''
let resultSummary = {}
// These will hold the parsed collection/env files
let collectionData
let envData

// Lifetime global counters
let runCount = 0
let iterationCount = 0
let reqCount = 0

//
// Entrypoint and server startup is here....
//

const app = express()

app.get(metricsUrlPath, (req, res) => {
  res.setHeader('content-type', 'text/plain; charset=utf-8; version=0.0.4')

  let metricString = ''
  try {
    metricString = addMetric(metricString, 'lifetime_runs_total', runCount, 'counter')
    metricString = addMetric(metricString, 'lifetime_iterations_total', iterationCount, 'counter')
    metricString = addMetric(metricString, 'lifetime_requests_total', reqCount, 'counter')
    metricString = addMetric(metricString, 'stats_iterations_total', resultSummary.run.stats.iterations.total)
    metricString = addMetric(metricString, 'stats_iterations_failed', resultSummary.run.stats.iterations.failed)
    metricString = addMetric(metricString, 'stats_requests_total', resultSummary.run.stats.requests.total)
    metricString = addMetric(metricString, 'stats_requests_failed', resultSummary.run.stats.requests.failed)
    metricString = addMetric(metricString, 'stats_tests_total', resultSummary.run.stats.tests.total)
    metricString = addMetric(metricString, 'stats_tests_failed', resultSummary.run.stats.tests.failed)
    metricString = addMetric(metricString, 'stats_test_scripts_total', resultSummary.run.stats.testScripts.total)
    metricString = addMetric(metricString, 'stats_test_scripts_failed', resultSummary.run.stats.testScripts.failed)
    metricString = addMetric(metricString, 'stats_assertions_total', resultSummary.run.stats.assertions.total)
    metricString = addMetric(metricString, 'stats_assertions_failed', resultSummary.run.stats.assertions.failed)
    metricString = addMetric(metricString, 'stats_transfered_bytes_total', resultSummary.run.transfers.responseTotal)
    metricString = addMetric(metricString, 'stats_resp_avg', resultSummary.run.timings.responseAverage)
    metricString = addMetric(metricString, 'stats_resp_min', resultSummary.run.timings.responseMin)
    metricString = addMetric(metricString, 'stats_resp_max', resultSummary.run.timings.responseMax)

    if (requestMetrics == 'true') {
      for (let execution of resultSummary.run.executions) {
        if (!execution.response) {
          continue
        }

        const labels = [
          {
            // eslint-disable-next-line camelcase
            request_name: execution.item.name,
          },
          {
            iteration: execution.cursor.iteration,
          },
        ]
        if (execution.response.code) {
          metricString = addMetric(metricString, 'request_status_code', execution.response.code, 'gauge', labels)
        }
        if (execution.response.responseTime) {
          metricString = addMetric(metricString, 'request_resp_time', execution.response.responseTime, 'gauge', labels)
        }
        if (execution.response.responseSize) {
          metricString = addMetric(metricString, 'request_resp_size', execution.response.responseSize, 'gauge', labels)
        }
        if (execution.response.status) {
          const statusOK = execution.response.status == 'OK' ? 1 : 0
          metricString = addMetric(metricString, 'request_status_ok', statusOK, 'gauge', labels)
        }

        let failedAssertions = 0
        let totalAssertions = 0
        // Include per request assertion metrics
        if (execution.assertions) {
          for (let a in execution.assertions) {
            totalAssertions++
            if (execution.assertions[a].error) {
              failedAssertions++
            }
          }
        }
        metricString = addMetric(metricString, 'request_failed_assertions', failedAssertions, 'gauge', labels)
        metricString = addMetric(metricString, 'request_total_assertions', totalAssertions, 'gauge', labels)
      }
    }

    res.send(metricString)
  } catch (err) {
    res.status(500).send('No result data to show, maybe the collection has not run yet')
  }
})

// I like the root path to at least return something
app.get('/', (req, res) => {
  res.setHeader('content-type', 'text/plain')
  res.status(404).send(`Nothing here, try ${metricsUrlPath}`)
})

// A health check endpoint, can be handy for probes
app.get('/health', (req, res) => {
  res.setHeader('content-type', 'text/plain')
  res.status(200).send('OK')
})

// This endpoint shows the current status of the server, what is being monitored, etc.
if (statusEnabled == 'true') {
  app.get('/status', (req, res) => {
    res.setHeader('content-type', 'application/json')

    // Get a simple summary of the loaded collection
    let monitoredRequests = []
    for (let item of collectionData.item) {
      monitoredRequests.push({
        name: item.name,
        url: item.request.url.raw,
        method: item.request.method,
      })
    }

    // Return a status summary object
    const status = {
      version: require('./package.json').version,
      config: {
        runInterval: parseInt(runInterval),
        refreshInterval: parseInt(refreshInterval),
        enableBail: enableBail == 'true',
        collectionSource: collectionUrl ? collectionUrl : collectionFile,
        envSource: envUrl ? envUrl : envFile,
        requestMetrics: requestMetrics == 'true',
        collectionName: collectionName,
      },
      runtimeCounters: {
        runCount,
        iterationCount,
        reqCount,
      },
      monitoredRequests,
    }
    res.status(200).send(JSON.stringify(status))
  })
}

app.listen(port, async () => {
  await fetchConfig()
  logMessage(`Newman runner started & listening on ${port}`)
  logMessage(` - Metrics available for scraping at: http://0.0.0.0:${port}${metricsUrlPath}`)
  if (statusEnabled == 'true') {
    logMessage(` - Status API endpoint: http://0.0.0.0:${port}/status`)
  }
  logMessage(` - Collection will be run every ${runInterval} seconds`)
  logMessage(` - Config refresh will be run every ${refreshInterval} seconds`)

  runCollection()

  // Set up repeating timers for refreshing the remote config and running the collection
  setInterval(async () => {
    await fetchConfig()
  }, parseInt(refreshInterval * 1000))

  setInterval(runCollection, parseInt(runInterval * 1000))
})

//
// Fetch collection & env file(s)
//

async function fetchConfig() {
  logMessage('Refreshing remote collection & env files')
  // COLLECTION_URL when set takes priority over COLLECTION_FILE
  if (collectionUrl) {
    logMessage(` - Collection URL will be fetched and used ${collectionUrl}`)
    try {
      const httpClient = new http(collectionUrl, false)
      let resp = await httpClient.get('')
      fs.writeFileSync(`./downloaded-collection.tmp.json`, resp.data)
      // Note. Overwrite the COLLECTION_FILE setting to point to downloaded file
      collectionFile = './downloaded-collection.tmp.json'
    } catch (err) {
      logMessage(` - FATAL! Failed to download collection from URL\n ${JSON.stringify(err, null, 2)}`)
      process.exit(1)
    }
  }

  // ENVIRONMENT_URL when set takes priority over ENVIRONMENT_FILE
  if (envUrl) {
    logMessage(` - Postman env file URL will be fetched and used ${envUrl}`)
    try {
      const httpClient = new http(envUrl, false)
      let resp = await httpClient.get('')
      fs.writeFileSync(`./downloaded-env.tmp.json`, resp.data)
      // Note. Overwrite the ENVIRONMENT_FILE setting to point to downloaded file
      envFile = './downloaded-env.tmp.json'
    } catch (err) {
      logMessage(` - FATAL! Failed to download env from URL\n ${JSON.stringify(err, null, 2)}`)
      process.exit(1)
    }
  }

  if (!fs.existsSync(collectionFile)) {
    logMessage(`FATAL! Collection file '${collectionFile}' not found`)
    process.exit(1)
  }
}

//
// Monitoring and Prometheus functions
//

function runCollection() {
  logMessage(`-------------------------------------------------------`)
  logMessage(`Starting run of ${collectionFile}`)

  // Special logic to bring all env vars starting with POSTMAN_ into the run
  let postmanEnvVar = []
  for (let envVar in process.env) {
    if (envVar.startsWith('POSTMAN_')) {
      postmanEnvVar.push({
        // Remove the prefix
        key: envVar.replace('POSTMAN_', ''),
        value: process.env[envVar],
      })
    }
  }

  // Load and parse collection and envfile each time, as it might have changed
  try {
    const collectionContent = fs.readFileSync(collectionFile)
    collectionData = JSON.parse(collectionContent.toString())

    envData = {}
    if (envFile) {
      const envContent = fs.readFileSync(envFile)
      envData = JSON.parse(envContent.toString())
    }

    // All the real work is done here
    newman.run(
      {
        collection: collectionData,
        iterationCount: parseInt(runIterations),
        bail: enableBail == 'true',
        environment: envData,
        envVar: postmanEnvVar,
      },
      runComplete
    )
  } catch (err) {
    logMessage(`FATAL! Failed to parse collection or environment file\n ${JSON.stringify(err, null, 2)}`)
    return
  }
}

function runComplete(err, summary) {
  if (!summary) {
    logMessage(`ERROR! Failed to run collection, no summary was returned!`)
    return
  }

  // This post run loop is for logging of what happened and some data clean up
  for (let e in summary.run.executions) {
    if (summary.run.executions[e].response !== undefined) {
      logMessage(
        ` - Completed request '${summary.run.executions[e].item.name}' in ${summary.run.executions[e].response.responseTime} ms ,Response Content is: ${summary.run.executions[e].response.stream}`
      )
      // Transfer Reponse body from byte to json string
      summary.run.executions[e].response.body = JSON.parse(summary.run.executions[e].response.stream.toString())
      // Remove the original stream data
      summary.run.executions[e].response.stream = '*REMOVED*'

      for (let a in summary.run.executions[e].assertions) {
        if (summary.run.executions[e].assertions[a].error) {
          logMessage(
            `ERROR! Request '${summary.run.executions[e].item.name}' - assertion failed: ${summary.run.executions[e].assertions[a].error.test}, Reason: ${summary.run.executions[e].assertions[a].error.message}`
          )

          // Junk we don't want in data
          // summary.run.executions[e].assertions[a].error.message = '*REMOVED*'
          // summary.run.executions[e].assertions[a].error.stack = '*REMOVED*'
        }
      }
    } else {
      logMessage(
        ` - Failed request '${summary.run.executions[e].item.name}' with ${summary.run.executions[e].requestError} `
      )
    }
  }
  fs.writeFileSync('debug.tmp.json', JSON.stringify(summary, null, 2))

  const time = summary.run.timings.completed - summary.run.timings.started
  logMessage(`Run complete, and took ${time}ms`)

  runCount++
  iterationCount += summary.run.stats.iterations.total
  reqCount += summary.run.stats.requests.total

  if (err) {
    logMessage(`ERROR! Failed to run collection ${err}`)
  }
  resultSummary = summary
  collectionName = summary.collection.name
}

function addMetric(metrics, name, value, type = 'gauge', labels = []) {
  metrics += `# TYPE postman_${name} ${type}\n`

  let labelsClone = [...labels]
  labelsClone.push({ collection: collectionName })

  let labelStr = ''
  for (let label of labelsClone) {
    let key = Object.keys(label)[0]
    let value = Object.values(label)[0]
    labelStr += `${key}="${value}",`
  }
  labelStr = labelStr.replace(/,\s*$/, '')

  metrics += `postman_${name}{${labelStr}} ${value}\n\n`
  return metrics
}

function logMessage(msg) {
  console.log(`### ${new Date().toISOString().replace('T', ' ').substr(0, 16)} ${msg}`)
}
