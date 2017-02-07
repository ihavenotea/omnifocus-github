#!/usr/bin/env node

var applescript = require("applescript");
var fs          = require('fs');
var github      = new (require("github"))({version: "3.0.0"});
var osenv       = require('osenv');
var temp        = require('temp').track();
var yaml        = require('js-yaml');

if (config = getConfig()) {
  github.authenticate({type: 'oauth', token: config.token});
}

function getUser () {
  return github.users.get({});
}

function getAssignments (data) {
  var username = data.login;
  var allAssignmentTypes =
      Promise.all([ github.issues.getAll({filter: "assigned"}),
                    github.search.issues({q:"is:open is:pr author:" +
                                          username}),
                    github.search.issues({q:"is:open is:pr review-requested:"
                                          + username})]);
  var concatItems = function(items, res) {
    return(items || []).concat(res.items || res);
  };

  return allAssignmentTypes.then(function(data) {
   return data.reduce(concatItems);
  });
}

function processItems(res) {
  var script = scriptForOmnifocusPro(res);

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
  } else if (m = item.repository_url.match(/repo\/(([^\/]+)\/(.+))/)) {
    result.full_name = m[1]
    result.org_name = m[2];
    result.name = m[3];
    result.url = item.repository_url
  }

  return result;
}

function scriptForOmnifocusPro(arr) {
  var ignored_orgs = config.ignored_orgs.split(',');
  var script = "tell application \"OmniFocus\"\n"
  script += "tell default document\n"
  for (var i = 0, len=arr.length; i < len; ++i) {

    var repo = repoInfo(arr[i]);
    if (config.ignored_orgs && ignored_orgs.includes(repo.org_name)) continue;
    script += "set issueURL to \"" + arr[i].html_url + "\"\n"
		script += "set matchCount to count (flattened tasks whose note contains issueURL)\n"
    script += "if matchCount is 0 then\n"
    script += "parse tasks into it with transport text  \"" +
      arr[i].title +
      " " + repo.full_name +
      " " + (config.default_context || "") +
      " //" + arr[i].html_url + "\"\n"
    script += "else\n"
    script += "set myTask to first flattened task whose note contains issueURL\n"
		script += "set completed of myTask to false\n"

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


getUser().
  then(getAssignments).
  then(processItems).
  catch(handleHttpErrors);
