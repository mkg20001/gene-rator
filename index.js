//Generator lib

"use strict"

function get(data, key) {
  return resolve(data, key, function (scope, key, value) {
    return value
  })
}

function set(data, key, value) {
  resolve(data, key, function (scope, key) {
    scope[key] = value
  })
  return (key, value) => set(data, key, value)
}

// Has a callback, but is NOT async
function resolve(data, key, callback) {
  var current = data
  var keys = key.split('.')
  key = keys.pop()
  keys.forEach(function (key) {
    current = current[key] || {}
  })
  return callback(current, key, current[key])
}

function GENEFunc(struct, req, id, name, resolve) {
  let mreq = get(req, id)

  if (!mreq) mreq = []
  else mreq = mreq.split(/ *,/g)

  const rv = resolve

  this.resF = resolve

  function getval(reqV, curStruct, cb) {
    if (typeof resolve == "string" && resolve.startsWith(":")) resolve = () => get(curStruct, rv.substr(1))

    const res = mreq.map(key => {
      const res = get(reqV, key)
      if (!res) return cb(new Error("ResolveError: Cannot resolve req " + key + " for " + id))
      return res
    })
    let r
    try {
      r = resolve.apply(curStruct, res)
    } catch (e) {
      return cb(e)
    }

    if (r) return cb(null, r)
    else return cb(new Error("No value returned by " + id))
  }
  this.get = getval
}

const rkeys = require("recursive-keys").dumpKeysRecursively

module.exports = function GENE(struct, req) {
  //obj=structure (string, func), req=additional req for structure thing
  /*
    First resolve all req - which we get from the cb
     - Then resolve all req
     - Then resolve all functions
       - Then look for string things and resolve them
  */
  const exploded = rkeys(struct).map(k => {
    if (typeof get(struct, k) == "object") return
    else return {
      key: k,
      val: new GENEFunc(struct, req, k, k.split(".").pop(), get(struct, k))
    }
  }).filter(e => !!e)
  return (reqV, count) => {
    function gen() {
      const res = {}
      let ex = exploded.slice(0)
      let prevlength = Infinity

      while (ex.length) {
        const del = {}
        let la
        ex.map(g => { //try to resolve all elements
          g.val.get(reqV, res, (err, res_) => {
            if (err) {
              la = err
            } else {
              if (Array.isArray(res_)) res_ = res_[Math.floor(Math.random() * res_.length)]
              set(res, g.key, res_)
              del[g.key] = true
            }
          })
        })
        ex = ex.filter(e => !del[e.key]) //remove all resolved elements from queue
        if (prevlength === ex.length) //if we get stuck it would result in an infinite while(true). Instead throw the last error
          throw la
        prevlength = ex.length
      }

      return res
    }
    const r = []
    while (count) {
      r.push(gen())
      count--
    }
    return r
  }
}

module.exports.randMinMax = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
