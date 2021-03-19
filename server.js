const newman = require('newman')
const express = require('express')
const fs = require('fs')
const http = require('./http.js')

let collectionFile = process.env.COLLECTION_FILE || './collection.json'
const collectionUrl = process.env.COLLECTION_URL || ''
const envFile = process.env.ENVIRONMENT_FILE || ''
const port = process.env.PORT || '8080'
const runInterval = process.env.RUN_INTERVAL || '30'
const runIterations = process.env.RUN_ITERATIONS || '1'
const enableBail = process.env.ENABLE_BAIL || 'false'

let collectionName = ''
let resultSummary = {}
let runCount = 0
let iterationCount = 0
let reqCount = 0

function runCollection() {
  logMessage(`Starting run of ${collectionFile}`)
  newman.run(
    {
      collection: require(collectionFile),
      iterationCount: parseInt(runIterations),
      bail: enableBail == 'true',
      environment: envFile,
    },
    runComplete
  )
}

function runComplete(err, summary) {
  if (!summary) {
    logMessage(`ERROR! Failed to run collection, no summary was returned!`)
    return
  }

  logMessage(`Run complete, and took ${summary.run.timings.completed - summary.run.timings.started}ms`)
  runCount++
  iterationCount += summary.run.stats.iterations.total
  reqCount += summary.run.stats.requests.total

  if (err) {
    logMessage(`ERROR! Failed to run collection ${err}`)
  }
  resultSummary = summary
  collectionName = summary.collection.name
}

function addMetric(metrics, name, value, type = 'gauge') {
  metrics += `# TYPE postman_${name} ${type}\n`
  metrics += `postman_${name}{collection="${collectionName}"} ${value}\n\n`
  return metrics
}

function logMessage(msg) {
  console.log(`### ${new Date().toISOString().replace('T', ' ').substr(0, 16)} ${msg}`)
}

//
// Entrypoint is here....
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
    metricString = addMetric(metricString, 'run_transfers_response_total', resultSummary.run.transfers.responseTotal)
    metricString = addMetric(metricString, 'timings_resp_avg', resultSummary.run.timings.responseAverage)
    metricString = addMetric(metricString, 'timings_resp_min', resultSummary.run.timings.responseMin)
    metricString = addMetric(metricString, 'timings_resp_max', resultSummary.run.timings.responseMax)

    //metricString = `postman_lifetime_runs_total 2555`
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
  if (collectionUrl) {
    logMessage(`Collection URL will be fetched and used ${collectionUrl}`)
    try {
      const h = new http(collectionUrl, false)
      let resp = await h.get('')
      fs.writeFileSync(`./downloaded-collection.tmp.json`, resp.data)
      collectionFile = './downloaded-collection.tmp.json'
    } catch (err) {
      logMessage(`FATAL! Failed to download collection from URL\n ${JSON.stringify(err, null, 2)}`)
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
