const newman = require('newman')
const express = require('express')
const fs = require('fs')
const http = require('./http.js')

let collectionFile = process.env.COLLECTION_FILE || './collection.json'
let envFile = process.env.ENVIRONMENT_FILE || ''
const collectionUrl = process.env.COLLECTION_URL || ''
const envUrl = process.env.ENV_URL || ''
const port = process.env.PORT || '8080'
const runInterval = process.env.RUN_INTERVAL || '30'
const runIterations = process.env.RUN_ITERATIONS || '1'
const enableBail = process.env.ENABLE_BAIL || 'false'
const requestMetrics = process.env.ENABLE_REQUEST_METRICS || 'true'

let collectionName = ''
let resultSummary = {}

// Lifetime global counters
let runCount = 0
let iterationCount = 0
let reqCount = 0

//
// Entrypoint and server startup is here....
//

const app = express()

app.get('/metrics', (req, res) => {
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

app.get('/', (req, res) => {
  res.setHeader('content-type', 'text/plain')
  res.status(404).send('Nothing here, try /metrics')
})

app.listen(port, async () => {
  // COLLECTION_URL when set takes priority over COLLECTION_FILE
  if (collectionUrl) {
    logMessage(`Collection URL will be fetched and used ${collectionUrl}`)
    try {
      const httpClient = new http(collectionUrl, false)
      let resp = await httpClient.get('')
      fs.writeFileSync(`./downloaded-collection.tmp.json`, resp.data)
      // Note. Overwrite the COLLECTION_FILE setting if it was already set
      collectionFile = './downloaded-collection.tmp.json'
    } catch (err) {
      logMessage(`FATAL! Failed to download collection from URL\n ${JSON.stringify(err, null, 2)}`)
      process.exit(1)
    }
  }

  // ENV_URL when set takes priority over ENVIRONMENT_FILE
  if (envUrl) {
    logMessage(`Postman Environment file URL will be fetched and used ${envUrl}`)
    try {
      const httpClient = new http(envUrl, false)
      let resp = await httpClient.get('')
      fs.writeFileSync(`./downloaded-env.tmp.json`, resp.data)
      // Note. Overwrite the ENVIRONMENT_FILE setting if it was already set
      envFile = './downloaded-env.tmp.json'
    } catch (err) {
      logMessage(`FATAL! Failed to download environment from URL\n ${JSON.stringify(err, null, 2)}`)
      process.exit(1)
    }
  }

  if (!fs.existsSync(collectionFile)) {
    logMessage(`FATAL! Collection file '${collectionFile}' not found`)
    process.exit(1)
  }

  logMessage(`Newman runner started & listening on ${port}`)
  logMessage(`Collection will be run every ${runInterval} seconds`)

  runCollection()
  setInterval(runCollection, parseInt(runInterval * 1000))
})

//
// Monitoring and Prometheus functions
//

function runCollection() {
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

  newman.run(
    {
      collection: require(collectionFile),
      iterationCount: parseInt(runIterations),
      bail: enableBail == 'true',
      environment: envFile,
      envVar: postmanEnvVar,
    },
    runComplete
  )
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
        ` - Completed request '${summary.run.executions[e].item.name}' in ${summary.run.executions[e].response.responseTime} ms`
      )

      // Junk we don't want in data
      summary.run.executions[e].response.stream = '*REMOVED*'

      for (let a in summary.run.executions[e].assertions) {
        if (summary.run.executions[e].assertions[a].error) {
          logMessage(
            `ERROR! Request '${summary.run.executions[e].item.name}' - assertion failed: ${summary.run.executions[e].assertions[a].error.test}, Reason: ${summary.run.executions[e].assertions[a].error.message}`
          )

          // Junk we don't want in data
          summary.run.executions[e].assertions[a].error.message = '*REMOVED*'
          summary.run.executions[e].assertions[a].error.stack = '*REMOVED*'
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
