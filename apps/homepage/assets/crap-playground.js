(function () {
  var ORIGIN = 'https://data.example';
  var TARGET = ORIGIN + '/v1/records';
  var REQUESTS = [
    { id: 'purpose', kind: 'declaration', message: 'What is this data for?',
      reason: 'The collection is licensed differently per use.', required: true,
      schema: { type: 'string', enum: ['academic_research', 'commercial_product', 'model_training'] } },
    { id: 'retention', kind: 'declaration', message: 'How long will you keep it?',
      reason: 'Retention over a year needs a data agreement.', required: false,
      schema: { type: 'string', enum: ['session', 'P30D', 'indefinite'] } }
  ];

  var state = { challenge: null, proof: null, decision: null };
  var log = document.getElementById('crap-log');
  var answersEl = document.getElementById('crap-answers');
  var btn = {
    start: document.getElementById('crap-start'),
    submit: document.getElementById('crap-submit'),
    retry: document.getElementById('crap-retry'),
    abuse: document.getElementById('crap-abuse'),
    reset: document.getElementById('crap-reset')
  };
  var nativeBox = document.getElementById('crap-native');
  if (!log || !btn.start) return;

  function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }
  function say(cls, label, detail) {
    var div = document.createElement('div');
    div.className = 'step ' + cls;
    div.innerHTML = '<span class="lbl">' + esc(label) + '</span>' +
      (detail ? '<pre>' + esc(detail) + '</pre>' : '');
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }
  function rand(n) {
    var out = '', abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < n; i++) out += abc[Math.floor(Math.random() * abc.length)];
    return out;
  }

  // ---- the "server" -------------------------------------------------
  function issue(method, target) {
    var id = 'ch_' + rand(8);
    return {
      id: id, version: 2, issuer: ORIGIN,
      expires_at: new Date(Date.now() + 900000).toISOString(),
      request_state: rand(24),
      scope: { method: method, target: target, has_content: false },
      input_requests: REQUESTS,
      submission: {
        method: 'POST',
        target: ORIGIN + '/.well-known/input-challenges/' + id + '/responses',
        content_type: 'application/crap-response+json'
      },
      continuation: { mode: 'retry-original-request' },
      max_rounds: 3, round: 1
    };
  }
  function validate(value, schema) {
    if (schema.type === 'string' && typeof value !== 'string') return 'expected string';
    if (schema.enum && schema.enum.indexOf(value) === -1) {
      return 'value not in enum: ' + JSON.stringify(schema.enum);
    }
    return null;
  }
  function submit(body) {
    if (!state.challenge || body.challenge_id !== state.challenge.id) {
      return { status: 403, problem: { detail: 'no such challenge' } };
    }
    if (state.challenge.consumed) {
      return { status: 403, problem: { detail: 'challenge already answered' } };
    }
    if (body.request_state !== state.challenge.request_state) {
      return { status: 403, problem: { detail: 'request_state mismatch' } };
    }
    var errors = [], answers = {};
    REQUESTS.forEach(function (r) {
      var declined = (body.declined || []).indexOf(r.id) !== -1;
      if (declined) {
        if (r.required) errors.push({ path: '/' + r.id, message: 'declined but required' });
        return;
      }
      var v = body.input_responses[r.id];
      if (v === undefined) {
        if (r.required) errors.push({ path: '/' + r.id, message: 'missing required answer' });
        return;
      }
      var bad = validate(v, r.schema);
      if (bad) { errors.push({ path: '/' + r.id, message: bad }); return; }
      answers[r.id] = { value: v, evidence: { class: 'self_asserted' } };
    });
    if (errors.length) return { status: 422, problem: { detail: 'answers rejected', errors: errors } };
    state.challenge.consumed = true;
    state.decision = {
      scope: state.challenge.scope, answers: answers, declined: body.declined || [],
      expires: Date.now() + 300000
    };
    return { status: 204, proof: 'ip1.dec_' + rand(22) + '.' + rand(43) };
  }
  function get(method, target, proof) {
    if (!proof) {
      state.challenge = issue(method, target);
      return { status: nativeBox.checked ? 430 : 403, challenge: state.challenge };
    }
    var d = state.decision;
    if (!d) return { status: 403, problem: { detail: 'unknown or expired proof' } };
    if (d.scope.method !== method) return { status: 403, problem: { detail: 'method mismatch' } };
    if (d.scope.target !== target) return { status: 403, problem: { detail: 'target mismatch' } };
    return {
      status: 200,
      body: {
        records: ['mud-crab-1', 'mud-crab-2', 'mud-crab-3'],
        served_because: Object.keys(d.answers).reduce(function (acc, k) {
          acc[k] = d.answers[k].value + ' (' + d.answers[k].evidence.class + ')';
          return acc;
        }, {})
      }
    };
  }

  // ---- the "client" -------------------------------------------------
  function renderAnswers(challenge) {
    answersEl.innerHTML = '';
    challenge.input_requests.forEach(function (r) {
      var wrap = document.createElement('div');
      wrap.className = 'q';
      var opts = ['<option value="__decline">— decline —</option>'].concat(
        r.schema.enum.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; })
      ).join('');
      wrap.innerHTML =
        '<label class="qm">' + esc(r.message) + (r.required ? ' <em>(required)</em>' : '') + '</label>' +
        '<select data-id="' + esc(r.id) + '">' + opts + '</select>' +
        '<span class="why">' + esc(r.reason || '') + '</span>';
      answersEl.appendChild(wrap);
    });
    var sels = answersEl.querySelectorAll('select');
    if (sels[0]) sels[0].selectedIndex = 1;
    if (sels[1]) sels[1].selectedIndex = 2;
  }

  btn.start.addEventListener('click', function () {
    log.innerHTML = '';
    state = { challenge: null, proof: null, decision: null };
    var accept = nativeBox.checked ? 'Accept-Input-Required: v=2' : '(no Accept-Input-Required)';
    say('', 'GET /v1/records', accept);
    var res = get('GET', TARGET, null);
    var label = res.status === 430 ? '← 430 Input Required' : '← 403 Forbidden (compatibility profile)';
    say('bad', label,
      'content-type: application/problem+json\ncache-control: no-store\nvary: accept-input-required\n\n' +
      JSON.stringify({
        type: 'https://crap.blah.dev/problems/input-required',
        status: res.status,
        challenge: {
          id: res.challenge.id,
          scope: res.challenge.scope,
          input_requests: res.challenge.input_requests.map(function (r) {
            return { id: r.id, kind: r.kind, required: r.required, message: r.message };
          }),
          submission: { target: res.challenge.submission.target }
        }
      }, null, 2));
    say('', 'client checks the binding',
      'issuer === responding origin        ✓\n' +
      'scope.method === GET                ✓\n' +
      'scope.target === requested URI      ✓\n' +
      'submission.target is same-origin    ✓\n' +
      'no secrets requested inline         ✓');
    renderAnswers(res.challenge);
    btn.submit.disabled = false;
    btn.retry.disabled = true;
    btn.abuse.disabled = true;
  });

  btn.submit.addEventListener('click', function () {
    var input_responses = {}, declined = [];
    Array.prototype.forEach.call(answersEl.querySelectorAll('select'), function (sel) {
      if (sel.value === '__decline') declined.push(sel.dataset.id);
      else input_responses[sel.dataset.id] = sel.value;
    });
    var body = {
      challenge_id: state.challenge.id,
      request_state: state.challenge.request_state,
      response_id: 'rsp_' + rand(10),
      input_responses: input_responses
    };
    if (declined.length) body.declined = declined;
    say('', 'POST ' + state.challenge.submission.target.replace(ORIGIN, ''),
      'content-type: application/crap-response+json\n\n' + JSON.stringify(body, null, 2));

    var res = submit(body);
    if (res.status === 204) {
      state.proof = res.proof;
      say('ok', '← 204 No Content', 'input-proof: ' + res.proof +
        '\n\n(opaque handle — the answers stay server-side, never in a header)');
      btn.retry.disabled = false;
      btn.submit.disabled = true;
    } else {
      say('bad', '← ' + res.status, JSON.stringify(res.problem, null, 2));
    }
  });

  btn.retry.addEventListener('click', function () {
    say('', 'GET /v1/records', 'input-proof: ' + state.proof);
    var res = get('GET', TARGET, state.proof);
    say(res.status === 200 ? 'ok' : 'bad', '← ' + res.status,
      JSON.stringify(res.body || res.problem, null, 2));
    btn.abuse.disabled = false;
    btn.retry.disabled = true;
  });

  btn.abuse.addEventListener('click', function () {
    say('', 'DELETE /v1/records', 'input-proof: ' + state.proof + '   (same proof, different method)');
    var res = get('DELETE', TARGET, state.proof);
    say('bad', '← ' + res.status, JSON.stringify(res.problem, null, 2));
    say('', 'why', 'The proof binds method, exact target, content presence,\n' +
      'content digest, principal and expiry. Earning it on a read\n' +
      'does not buy you a delete.');
    btn.abuse.disabled = true;
  });

  btn.reset.addEventListener('click', function () {
    log.innerHTML = '';
    answersEl.innerHTML = '';
    state = { challenge: null, proof: null, decision: null };
    btn.submit.disabled = true;
    btn.retry.disabled = true;
    btn.abuse.disabled = true;
  });
})();
