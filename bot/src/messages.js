'use strict'

const path = require('path')

function loadMessages (locale = process.env.WORKER_LOCALE || 'de') {
  try {
    return require(path.join(__dirname, '..', 'locales', `${locale}.json`))
  } catch {
    if (locale !== 'de') return loadMessages('de')
    throw new Error('Die deutsche WorkerBot-Übersetzung konnte nicht geladen werden.')
  }
}

function formatMessage (template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] == null ? match : String(values[key]))
}

module.exports = { loadMessages, formatMessage }
