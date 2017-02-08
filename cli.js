#!/usr/bin/env node

var AssignmentSource = require('./lib/assignment-source.js')
var Config = require('./lib/config.js')
var GitHubApi = require('github')
var OmniFocusSync = require('./lib/omnifocus-sync.js')
var PromiseConcatenator = require('./lib/promise-concatenator.js')

var config = new Config()
var omniSync = new OmniFocusSync(config.settings)

var connections = config.connections()

var sourceAssignments = Array.from(Object.values(connections), (conn) => {
  let api = new GitHubApi(conn.settings)
  api.authenticate(conn.auth)

  let source = new AssignmentSource(api)
  let assignments = source.getAssignments()
  return assignments
})

new PromiseConcatenator(sourceAssignments).
  then((data) => omniSync.processItems(data)).
  then(() => console.log("Sync Complete.")).
  catch(console.error)
