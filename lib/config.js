var fs = require('fs')
var osenv = require('osenv')
var yaml = require('js-yaml')

class Config {

  constructor () {
    this.load()
  }

  settings () {
    return this.settings
  }

  connections () {
    var results = {}

    if (this.settings.connections) {
      let connections = this.settings.connections

      for(let name in connections) {
        let conn = connections[name]
        var auth = { type: 'oauth',
                     token: connections[name].token }
        var settings = { version: "3.0.0" }

        if (conn.host) {
          settings.host = conn.host
          if (conn.host !== 'api.github.com') {
            settings.pathPrefix = "/api/v3"
          }
        }
        results[name] = { auth: auth,
                          settings: settings }
      }

    } else {
      // FHK test this as a default
      results.github = { settings: { version: "3.0.0" },
                         auth: { type: 'oauth',
                                 token: this.settings.token }
                       }
    }
    return results;
  }

  load () {
    var path = osenv.home() + '/.omnifocus-github'

    try {
      this.settings = yaml.safeLoad(fs.readFileSync(path, 'utf8'))
      this.settings.dryrun = process.argv.includes('--dry-run')
    } catch (err) {
      if (err.code === 'ENOENT' && err.path === path) {
        console.log('Please create a ' + path + ' configuration file.')
      }
      else {
        throw err
      }
    }
  }
}

module.exports = Config
