var PromiseConcatenator = require('./promise-concatenator.js')

class AssignmentSource {

  constructor (connection) {
    this.connection = connection
  }

  handleHttpErrors (err) {
    switch (err.code) {
    case 401:
      console.error('Could not authenticate. ' +
                    'Check your oauth token in your configuration file.')
      break
    default:
      throw err
    }
  }

  getUser () {
    if (this.userPromise == null) {
      this.userPromise = this.connection.users.get({})
    }
    return this.userPromise
  }

  getIssues () {
    return this.connection.issues.getAll({filter: "assigned"})
  }

  getPullRequests () {
    return this.getUser().then( (data) => {
      var query = "is:open is:pr author:" + data.login
      return this.connection.search.issues({q:query}).then(res => res.items)
    })
  }

  getReviewRequests () {
    return this.getUser().then( (data) => {
      var query = "is:open is:pr review-requested:" + data.login
      return this.connection.search.issues({q:query}).then(res => res.items)
    })
  }

  getAssignments () {
    return new PromiseConcatenator([ this.getIssues(),
                                     this.getPullRequests(),
                                     this.getReviewRequests()])
  }

}

module.exports = AssignmentSource
