var applescript = require("applescript")
var fs = require('fs')
var temp = require('temp').track()

class OmniFocusSync {

  constructor (options = {}) {
    this.dryrun = options.dryrun
    this.ignored_orgs =
      options.ignored_orgs ? options.ignored_orgs.split(',') : []
    this.default_context = options.default_context || ""
  }

  repoInfo (item) {
    var result = {}

    if (item.repository) {
      result.org_name = item.repository.owner.login
      result.url = item.repository.html_url
      result.full_name = item.repository.full_name
      result.name = item.repository.name
    } else if (item.repository_url) {
      var m = item.repository_url.match(/repos\/(([^\/]+)\/(.+))/)
      if (m) {
        result.full_name = m[1]
        result.org_name = m[2]
        result.name = m[3]
        result.url = item.repository_url
      }
    }

    return result
  }

  generateAppleScript (items) {
    var script = "tell application \"OmniFocus\"\n"
    script +=    "  tell default document\n"
    for (var item of items) {
      var repo = this.repoInfo(item)
      if (this.ignored_orgs.includes(repo.org_name)) continue
      script += "    set issueURL to \"" + item.html_url + "\"\n"
		  script += "    set matchCount to count (flattened tasks whose note contains issueURL)\n"
      script += "    if matchCount is 0 then\n"
      script += "      parse tasks into it with transport text \"" +
        item.title +
        " " + repo.full_name +
        " " + (this.default_context) +
        " //" + item.html_url + "\"\n"
      script += "    else\n"
      script += "      set myTask to first flattened task whose note contains issueURL\n"
		  script += "      set completed of myTask to false\n"

      script += "    end if\n"
    }
    script += "  end tell\n"
    script += "end tell\n"

    return script
  }

  processItems(items) {
    var script = this.generateAppleScript(items)

    if(this.dryrun) {
      console.log(script)
      return
    }

    temp.open('omnifocus-github', function(err, info) {
      if (!err) {
        fs.writeSync(info.fd, script)
        fs.close(info.fd, function(err) {
          applescript.execFile(info.path, [])
        })
      }
    })
  }

}

module.exports = OmniFocusSync
