"use strict";

const promiserFactory = globalThis.sqlite3Worker1Promiser.v2;
// mandatory semi or the IIFE breaks
delete globalThis.sqlite3Worker1Promiser;

(async function() {
  const promiserConfig = {
    onready: (f) => undefined,
    debug: (...args) => undefined,
    onunhandled: function (ev) {
      error("Unhandled worker message:", ev.data)
    },
    onerror: function (ev) {
      error("worker1 error:", ev)
    }
  }

  const workerPromise = await promiserFactory(promiserConfig)
  const db = async function (type, args, cb) {
    return workerPromise({ type, args, }).then(cb)
  }

  window.db = db
  window.query = async function (sql) {
    return await db('exec', {
      sql,
      rowMode: 'object',
    }, ({ result }) => {
      console.debug(result.resultRows)
      document.getElementById('results').innerHTML = JSON.stringify(result.resultRows, null, 4)
    })
  }

  const main = async function () {
    const dbFilename = '/parse.sqlite3'

    await db('open', {
      filename: dbFilename,
    }, (ev) => {
      promiserConfig.dbId = ev.dbId
      console.debug(ev.dbId)
    })

    await db('exec', {
      sql: [
        "create table dmg(a, b)",
        "insert into dmg(a, b) values (1, 2), (3, 4)",
      ].join(";"),
      resultRows: [],
      columnNames: [],
      lastInsertRowId: true,
      countChanges: false,
    }, ({ result }) => {
      console.debug(result)
    })

    for (let i = 0; i < 10000; i++) {
      await db('exec', {
        sql: `insert into dmg(a, b) values (${i}, ${i})`,
      })
    }

    await db('exec', {
      sql: 'select * FROM dmg',
      rowMode: 'object',
    }, ({ result }) => {
      console.debug(result)
      // alert(JSON.stringify(result.resultRows))
    })
  }

  main()
})();


document.getElementById('run').addEventListener('click', () => {
  window.query(document.getElementById('query').value)
})
