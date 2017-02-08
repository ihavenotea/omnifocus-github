#!/usr/bin/env node

var applescript = require("applescript");
var fs          = require('fs');
var github      = new (require("github"))({version: "3.0.0"});
var osenv       = require('osenv');
var temp        = require('temp').track();
var yaml        = require('js-yaml');

var AssignmentSource = require('./lib/assignment-source.js');
var OmniFocusSync = require('./lib/omnifocus-sync.js');

var config = getConfig();
var dryrun = process.argv.includes('--dry-run');

if (config) {
  github.authenticate({type: 'oauth', token: config.token});
}

var omniSync = new OmniFocusSync({dryrun: dryrun,
                                  ignored_orgs: config.ignored_orgs,
                                  default_context: config.default_context});

source = new AssignmentSource(github);

function getConfig() {
  var path = osenv.home() + '/.omnifocus-github';

  try {
    return yaml.safeLoad(fs.readFileSync(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT' && err.path === path) {
      console.log('Sorry, you must create a ' + path + ' configuration file.');
    }
    else {
      throw err;
    }
  }
}

source.getAssignments().
  then((data) => omniSync.processItems(data)).
  then(() => console.log("Sync Complete.")).
  catch(source.handleHttpErrors)
