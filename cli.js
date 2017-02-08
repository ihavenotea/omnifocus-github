#!/usr/bin/env node

var applescript = require("applescript");
var fs          = require('fs');
var github      = new (require("github"))({version: "3.0.0"});
var osenv       = require('osenv');
var temp        = require('temp').track();
var yaml        = require('js-yaml');

var AssignmentSource = require('./lib/assignment-source.js');

var config = getConfig();
var dryrun = process.argv.includes('--dry-run');

if (config) {
  github.authenticate({type: 'oauth', token: config.token});
}

source = new AssignmentSource(github);

function processItems(items) {
  var script = scriptForOmnifocusPro(items);

  if(dryrun) {
    console.log(script);
    return;
  }

  temp.open('omnifocus-github', function(err, info) {
    if (!err) {
      fs.writeSync(info.fd, script);
      fs.close(info.fd, function(err) {
        applescript.execFile(info.path, []);
      });
    }
  });
}

function repoInfo(item) {
  var result = {};

  if (item.repository) {
    result.org_name = item.repository.owner.login;
    result.url = item.repository.html_url
    result.full_name = item.repository.full_name
    result.name = item.repository.name
  } else if (item.repository_url) {
    var m = item.repository_url.match(/repo\/(([^\/]+)\/(.+))/);
    if (m) {
      result.full_name = m[1]
      result.org_name = m[2];
      result.name = m[3];
      result.url = item.repository_url
    }
  } else {
    console.error("Could not process entry:");
    console.error(item);
  }

  return result;
}

function scriptForOmnifocusPro(items) {
  var ignored_orgs = config.ignored_orgs.split(',');
  var script = "tell application \"OmniFocus\"\n"
  script +=    "  tell default document\n"
  for (var item of items) {
    var repo = repoInfo(item);
    if (config.ignored_orgs && ignored_orgs.includes(repo.org_name)) continue;
    script += "    set issueURL to \"" + item.html_url + "\"\n"
		script += "    set matchCount to count (flattened tasks whose note contains issueURL)\n"
    script += "    if matchCount is 0 then\n"
    script += "      parse tasks into it with transport text \"" +
      item.title +
      " " + repo.full_name +
      " " + (config.default_context || "") +
      " //" + item.html_url + "\"\n"
    script += "    else\n"
    script += "      set myTask to first flattened task whose note contains issueURL\n"
		script += "      set completed of myTask to false\n"

    script += "    end if\n"
  }
  script += "  end tell\n"
  script += "end tell\n"
  return script;
}

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

function handleHttpErrors(err) {
  switch (err.code) {
    case 401:
      console.log('Could not authenticate. Check your oauth token in your configuration file.');
      break;
    default:
      throw err;
  }
}

source.getAssignments().
  then(processItems).
  then(function (data) {console.log("Sync Complete.")}).
  catch(handleHttpErrors);
