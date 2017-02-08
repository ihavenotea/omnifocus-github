class PromiseConcatenator {

  constructor (promises) {
    this.promises = Promise.all(promises)
  }

  then (resolve, reject) {
    var concatItems = (items, res) => (items || []).concat(res)
    return this.promises.then((data) => resolve(data.reduce(concatItems, [])),
                              reject)
  }

}

module.exports = PromiseConcatenator
