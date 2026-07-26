"use strict";

function msg (s) {
  console.debug(s)

  if (typeof(s) !== 'string') {
    s = JSON.stringify(s, null, 4)
  }

  document.getElementById('results').innerHTML = s

  return s
}

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
    msg('loading...')
    return await db('exec', {
      sql,
      rowMode: 'object',
    }, ({ result }) => {
      console.debug(result.resultRows)
      msg(result.resultRows)
    }).catch((e) => {
      msg(e.result)
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
      sql: `
PRAGMA synchronous = OFF;
PRAGMA journal_mode = MEMORY;
`
    });

    await db('exec', {
      sql: "create table dmg(log, typ, tar, val)",
      resultRows: [],
      columnNames: [],
      lastInsertRowId: true,
      countChanges: false,
    }, ({ result }) => {
      console.debug(result)
    })

    await db('exec', {
      sql: 'select * FROM dmg',
      rowMode: 'object',
    }, ({ result }) => {
      console.debug(result)
    })
  }

  main()
})();


document.querySelectorAll('.run')
  .forEach(el => el.addEventListener('click', () => {
    const stmt = el.parentNode.querySelector('.query').value
    window.query(stmt)
  }))

const MELEE_REGEX = /You (pierce|slash|crush) (.*?) for (\d+) points of damage./;
const clean = s => s.replace(/'/g, "''")

function parse (line) {
  if (!/You (crush|pierce|slash)/.test(line)) {
    return null
  }

  // "[Mon Jul 13 23:45:56 2026] You pierce Drelzna for 17 points of damage."
  // .match(/You (pierce|slash|crush) (.*?) for (\d+) points of damage./)
  let parts = line.match(MELEE_REGEX)

  if (parts) {
    parts = parts.map(clean)
    return {
      log: parts[0],
      typ: parts[1],
      tar: parts[2],
      val: parts[3],
    }
  }

  // TODO: Add more damage type regexes
  return null
}

document.getElementById('fileInput').addEventListener('change', async function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const startTime = performance.now();
  const stream = file.stream();
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();

  let leftover = '';
  let batch = [];
  const BATCH_SIZE = 2500;

  // Start a single outer transaction for speed
  await window.db('exec', { sql: 'BEGIN TRANSACTION;' });

  async function flushBatch() {
    if (batch.length === 0) return;

    // Construct multi-row INSERT: INSERT INTO dmg(a, b) VALUES ('x', 'line1'), ('x', 'line2'), ...
    const valuesClause = batch.map((parsed) => {
      return `('${parsed.typ}', '${parsed.tar}', '${parsed.val}', '${parsed.log}')`
    }).join(',');
    await window.db('exec', {
      sql: `INSERT INTO dmg(typ, tar, val, log) VALUES ${valuesClause};`
    });
    batch = [];
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = leftover + value;
    const lines = chunk.split(/\r?\n/);
    leftover = lines.pop();

    for (let line of lines) {
      if (!line) continue;
      const parsed = parse(line)
      if (!parsed) continue;

      batch.push(parsed);

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }
  }

  // Handle remaining lines
  if (leftover) {
    batch.push(leftover.replace(/'/g, "''"));
  }
  await flushBatch();

  // Commit all inserts in one go
  await window.db('exec', { sql: 'COMMIT;' });

  msg(`Import completed in ${((performance.now() - startTime) / 1000).toFixed(2)} seconds!`);
});
