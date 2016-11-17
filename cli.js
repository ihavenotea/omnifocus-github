#!/usr/bin/env node

var applescript = require("applescript");
var fs          = require('fs');
var github      = new (require("github"))({version: "3.0.0"});
var osenv       = require('osenv');
var temp        = require('temp').track();
var yaml        = require('js-yaml');

if (config = getConfig()) {
  github.authenticate({type: 'oauth', token: config.token});
  github.issues.getAll({filter: "assigned"}, processIssues);
}

function processIssues(err, res) {
  if (err) {
    handleHttpErrors(err);
    return;
  }

  var script = scriptForOmnifocusPro(res);

  temp.open('omnifocus-github', function(err, info) {
    if (!err) {
      fs.write(info.fd, script);
      fs.close(info.fd, function(err) {
        // @TODO: Remove empty callback when https://github.com/TooTallNate/node-applescript/issues/8 is resolved
        applescript.execFile(info.path, [], function(err, rtn) { });
      });
    }
  });
}

function formatScript(arr) {
  var script = "";
  for (var i = 0, len=arr.length; i < len; ++i) {
    var issueName = arr[i].repository.full_name + "/issues/" + arr[i].number;

    script += "of = Library('OmniFocus');"
    + "var name = '"+ issueName + "';"
    + "if (of.tasksWithName(name).length <= 0) {"
    + "of.parse('" + issueName +" @GitHub');"
    + "}\n"
  }
  return script;
}

function scriptForOmnifocusPro(arr) {
  var script = "tell application \"OmniFocus\"\n"
  script += "tell default document\n"
  for (var i = 0, len=arr.length; i < len; ++i) {
    var issueName = arr[i].repository.full_name + "/issues/" + arr[i].number;
    if (config.ignored_orgs && config.ignored_orgs.includes(arr[i].repository.owner.login)) continue;
    script += "set matchCount to count (flattened tasks whose name is \"" + issueName + "\")\n"
    script += "if matchCount is 0 then\n"
    script += "parse tasks into it with transport text  \"" + issueName + " " + (config.default_context || "@GitHub") + " //" + arr[i].html_url + "\n" + arr[i].title + "\"\n"
    script += "end if\n"
  }
  script += "end tell\n"
  script += "activate \"OmniFocus\"\n"
  script += "end tell\n"
  return script;
}

function projectForRepo(repo) {
  // TODO : figure out the syntax for setting the project
  switch(repo.full_name) {
  default:
    return ""
  }
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
