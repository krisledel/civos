"""Generate a self-contained, escaped HTML report from verified ledger events."""

from datetime import datetime, timezone
from html import escape
import json
import re

from .model import parse_timestamp


def h(value):
    return escape(str(value), quote=True)


def review_state(records, as_of=None):
    clock = parse_timestamp(as_of, "as_of") if as_of else datetime.now(timezone.utc)
    superseded = {record["supersedes"] for record in records if "supersedes" in record}
    current = [record for record in records if record["id"] not in superseded]
    by_id = {record["id"]: record for record in records}
    claims, decisions = {}, []
    for record in records:
        if record["kind"] != "claim":
            continue
        evidence = [item for item in current if item["kind"] == "evidence" and item["claim_id"] == record["id"]]
        assessments = [item for item in current if item["kind"] == "assessment" and item["claim_id"] == record["id"]]
        disputed = any(item["stance"] == "disputes" for item in evidence) or any(
            item["verdict"] == "disputes" for item in assessments)
        stale = any(eid in superseded for item in assessments for eid in item["evidence_ids"])
        uncertain = any(item["verdict"] == "uncertain" for item in assessments)
        claims[record["id"]] = dict(record=record, evidence=evidence, assessments=assessments,
                                     disputed=disputed, stale=stale, uncertain=uncertain)
    for record in current:
        if record["kind"] != "decision":
            continue
        outcomes = [item for item in current if item["kind"] == "outcome" and item["decision_id"] == record["id"]]
        issues = []
        for cid in record["claim_ids"]:
            claim = claims[cid]
            if claim["disputed"]:
                issues.append(f"Disputed basis: {cid}")
            if claim["uncertain"]:
                issues.append(f"Uncertain assessment: {cid}")
            if not claim["evidence"]:
                issues.append(f"No evidence recorded: {cid}")
            if not claim["assessments"]:
                issues.append(f"No assessment recorded: {cid}")
            if cid in superseded:
                issues.append(f"Claim has a newer revision: {cid}")
            if claim["stale"]:
                issues.append(f"Assessment cites revised evidence: {cid}")
        overdue = parse_timestamp(record["review_at"]) <= clock and not outcomes
        if overdue:
            issues.append("Review overdue; no outcome recorded")
        if any(item["result"] != "met" for item in outcomes):
            issues.append("Follow-up contains an unmet or inconclusive result")
        decisions.append(dict(record=record, outcomes=outcomes, issues=issues, overdue=overdue))
    return dict(clock=clock.isoformat(), current=current, claims=claims, decisions=decisions,
                superseded=superseded, by_id=by_id)


def link(identifier):
    return f'<a class="record-link" href="#record-{h(identifier)}">{h(identifier)}</a>'


def field(label, value):
    return f'<div class="field"><dt>{h(label)}</dt><dd>{h(value)}</dd></div>'


def render_report(events, as_of=None):
    records = [event["record"] for event in events]
    state = review_state(records, as_of)
    current_claims = [item for item in state["current"] if item["kind"] == "claim"]
    disputed_count = sum(state["claims"][item["id"]]["disputed"] for item in current_claims)
    overdue_count = sum(item["overdue"] for item in state["decisions"])
    head = events[-1]["hash"] if events else "0" * 64
    cards = []
    for number, item in enumerate(state["decisions"], 1):
        record = item["record"]
        notices = ''.join(f'<li>{h(issue)}</li>' for issue in item["issues"])
        outcomes = ''.join('<div class="outcome"><span class="eyebrow">Recorded outcome · '
                           + h(outcome["result"]) + '</span><p>' + h(outcome["observation"])
                           + '</p><p><strong>Next action:</strong> ' + h(outcome["next_action"])
                           + '</p>' + link(outcome["id"]) + '</div>' for outcome in item["outcomes"])
        status = "Review overdue" if item["overdue"] else "Outcome recorded" if item["outcomes"] else "Awaiting follow-up"
        cards.append(f'''<article class="decision searchable" data-attention="{str(bool(item['issues'])).lower()}">
          <div class="card-top"><span class="eyebrow">Decision {number:02d}</span><span class="pill {'warn' if item['issues'] else ''}">{h(status)}</span></div>
          <h3>{h(record['action'])}</h3><p>{h(record['rationale'])}</p>
          <dl class="fields">{field('Accountable owner', record['owner'])}{field('Review due', record['review_at'])}</dl>
          <div class="basis"><span class="eyebrow">Claim basis</span> {' '.join(link(cid) for cid in record['claim_ids'])}</div>
          <dl class="fields">{field('Success criteria', record['success_criteria'])}{field('Stop condition', record['stop_condition'])}{field('Dissent retained', record['dissent'])}{field('Alternatives considered', ' · '.join(record['alternatives']))}</dl>
          {'<ul class="issues">' + notices + '</ul>' if notices else ''}{outcomes}
          <div class="card-bottom">{link(record['id'])}<span>{h(record['created_at'])}</span></div>
        </article>''')
    claim_cards = []
    for record in current_claims:
        claim = state["claims"][record["id"]]
        claim_status = 'Disputed' if claim['disputed'] else 'Uncertain assessment' if claim['uncertain'] else 'Unassessed' if not claim['assessments'] else 'No dispute recorded'
        evidence = ''.join(f'<li><span class="stance">{h(item["stance"])}</span> {link(item["id"])}<p>{h(item["summary"])}</p></li>' for item in claim["evidence"])
        assessments = ''.join(f'<li><span class="stance">{h(item["verdict"])}</span> {link(item["id"])}<p>{h(item["author"])}: {h(item["rationale"])}</p></li>' for item in claim["assessments"])
        claim_cards.append(f'''<article class="claim searchable" data-attention="{str(claim['disputed'] or claim['uncertain'] or not claim['evidence'] or not claim['assessments'] or claim['stale']).lower()}">
          <div class="card-top"><span class="eyebrow">{h(record['id'])}</span><span class="pill {'warn' if claim['disputed'] or claim['uncertain'] else ''}">{claim_status}</span></div>
          <h3>{h(record['statement'])}</h3><p>{h(record['context'])}</p>
          <dl class="fields">{field('Assumptions', ' · '.join(record['assumptions']) or 'None recorded')}{field('Limitations', ' · '.join(record['limitations']) or 'None recorded')}</dl>
          <h4>Evidence</h4><ul class="evidence-list">{evidence or '<li>No evidence recorded.</li>'}</ul>
          <h4>Assessments</h4><ul class="evidence-list">{assessments or '<li>No assessment recorded.</li>'}</ul>
          {'<p class="issues">An assessment cites evidence that has been revised. Review the reference.</p>' if claim['stale'] else ''}
          {link(record['id'])}</article>''')
    history = []
    for event in events:
        record = event["record"]
        relationships = []
        for key in ("claim_id", "decision_id", "supersedes"):
            if key in record:
                relationships.append(h(key) + ': ' + link(record[key]))
        for key in ("claim_ids", "evidence_ids"):
            if key in record:
                relationships.append(h(key) + ': ' + ' '.join(link(identifier) for identifier in record[key]))
        source = ''
        if record["kind"] == "evidence":
            uri = record["source_uri"]
            source = ('<a href="' + h(uri) + '" rel="noreferrer noopener" target="_blank">' + h(uri) + '</a>') if uri.startswith(('https://', 'http://')) else h(uri)
            source = '<p class="source">Source reference: ' + source + '</p>'
        is_old = record["id"] in state["superseded"]
        history.append(f'''<details class="event searchable" id="record-{h(record['id'])}" data-attention="false">
          <summary><span class="sequence">{event['seq']:03d}</span><span class="event-kind">{h(record['kind'])}</span><strong>{h(record['id'])}</strong><span class="revision">{'Superseded' if is_old else 'Current'}</span></summary>
          <div class="event-body"><p>{' · '.join(relationships)}</p>{source}<pre>{h(json.dumps(record, ensure_ascii=False, indent=2))}</pre><p class="hash">SHA-256 {h(event['hash'])}</p></div>
        </details>''')
    demo_notice = '<p class="issues">Fictional demonstration. All actors, observations and outcomes are invented.</p>' if records and all('(fictional)' in record['author'] for record in records) else ''
    replacements = {"DEMO_NOTICE": demo_notice, "CLOCK": h(state["clock"]), "RECORDS": str(len(records)), "DISPUTED": str(disputed_count),
                       "DECISIONS": str(len(state["decisions"])), "OVERDUE": str(overdue_count),
                       "HEAD": h(head), "DECISION_CARDS": ''.join(cards) or '<p>No decisions recorded.</p>',
                       "CLAIM_CARDS": ''.join(claim_cards) or '<p>No claims recorded.</p>',
                       "HISTORY": ''.join(history) or '<p>The ledger is empty.</p>'}
    return re.sub(r"\{\{([A-Z_]+)\}\}", lambda match: replacements[match[1]], TEMPLATE)


TEMPLATE = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="author" content="Kris Ledel"><title>CivOS — Decision review</title>
<style>
:root{--paper:#f5f2e9;--ink:#182722;--muted:#59655d;--line:#cdd2c5;--accent:#b34522;--soft:#f6e4d8}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0;background:var(--paper);color:var(--ink);font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6}a{color:inherit;text-underline-offset:3px}a:hover{color:var(--accent)}button,input{font:inherit}button,a,input,summary{outline-offset:5px}.wrap{max-width:1280px;margin:auto;padding:0 40px}.top{border-bottom:1px solid var(--line)}.top .wrap{display:flex;align-items:center;justify-content:space-between;padding-top:22px;padding-bottom:22px}.brand{font-size:27px;letter-spacing:-1.4px;font-weight:800;text-decoration:none}.brand span{color:var(--accent)}.byline{font-size:12px;letter-spacing:1.5px;text-transform:uppercase}.hero{padding-top:68px;padding-bottom:40px;display:grid;grid-template-columns:1.6fr 1fr;gap:65px;align-items:end}.eyebrow{font-family:Consolas,monospace;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:var(--muted)}h1{font-size:clamp(46px,5vw,72px);line-height:1.02;letter-spacing:-3.6px;font-weight:500;margin:18px 0 26px}h1 span{color:var(--accent)}.intro{max-width:480px;font-size:17px;margin:0}.meta{border-left:2px solid var(--accent);padding-left:24px;font-size:13px}.meta p{margin:8px 0 20px}.hash{font-family:Consolas,monospace;font-size:11px;overflow-wrap:anywhere;color:var(--muted)}.flow{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:24px 0;color:var(--muted);font-family:Consolas,monospace;font-size:12px}.flow b{color:var(--accent);font-size:18px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-top:15px}.metric{padding:23px 25px 24px 0}.metric:not(:first-child){padding-left:25px;border-left:1px solid var(--line)}.metric strong{display:block;font-size:46px;line-height:1.2;font-weight:400;letter-spacing:-2px}.metric.attention strong{color:var(--accent)}.metric span{font-size:12px;color:var(--muted)}.toolbar{display:flex;justify-content:space-between;align-items:end;gap:20px;padding:32px 0 8px}.search{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--muted);width:360px;max-width:100%}input[type=search]{border:1px solid var(--line);background:#fffdf7;padding:11px 13px;width:100%;color:var(--ink)}.actions{display:flex;gap:20px;align-items:center;font-size:12px}.actions button{border:1px solid var(--ink);background:transparent;padding:9px 16px;cursor:pointer}.filter{display:flex;gap:8px;align-items:center}section{padding:34px 0}.section-head{display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid var(--ink);margin-bottom:24px;gap:25px}h2{font-size:27px;font-weight:500;letter-spacing:-.7px;margin:0 0 12px}.section-head p{font-size:12px;color:var(--muted);margin:0 0 12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}.decision,.claim{padding:27px;background:#fffdf7;border:1px solid var(--line);border-top:3px solid var(--ink);min-width:0}.claim{background:transparent;border-top:1px solid var(--line)}.card-top,.card-bottom{display:flex;justify-content:space-between;gap:16px;align-items:center}.pill{font-size:10px;line-height:1.5;letter-spacing:.4px;padding:5px 8px;border:1px solid var(--line);white-space:nowrap}.pill.warn{color:var(--accent);background:var(--soft);border-color:#ddbea9}h3{font-size:23px;line-height:1.3;font-weight:500;letter-spacing:-.4px;margin:20px 0 14px}.decision p,.claim p{font-size:13px;line-height:1.7}.fields{margin:23px 0;display:grid;grid-template-columns:1fr 1fr;gap:18px}.field dt{font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);margin-bottom:5px}.field dd{font-size:12px;margin:0;overflow-wrap:anywhere}.basis{padding:13px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:12px}.basis .eyebrow{margin-right:10px}.record-link{font-family:Consolas,monospace;font-size:11px;overflow-wrap:anywhere}.issues{font-size:12px;background:var(--soft);border-left:2px solid var(--accent);padding:12px 14px 12px 28px;color:#83351f}.outcome{border-top:1px solid var(--line);padding-top:20px;margin-top:24px}.card-bottom{margin-top:26px;color:var(--muted);font-size:10px}h4{font-size:12px;letter-spacing:1px;text-transform:uppercase;margin:24px 0 12px}.evidence-list{padding:0;list-style:none}.evidence-list li{padding:10px 0;border-top:1px solid var(--line);font-size:12px}.evidence-list p{margin:7px 0}.stance{font-size:10px;text-transform:uppercase;color:var(--accent);margin-right:8px}.event{border-bottom:1px solid var(--line);scroll-margin-top:24px}.event:target{background:#ecebdc}.event summary{cursor:pointer;padding:15px 4px;display:flex;gap:20px;align-items:center;font-size:12px}.sequence{font-family:Consolas,monospace;color:var(--muted)}.event-kind{width:90px;text-transform:uppercase;font-size:10px;letter-spacing:1px}.revision{margin-left:auto;font-size:10px;color:var(--muted)}.event-body{padding:4px 24px 20px}.event-body pre{font:12px/1.6 Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.source{font-size:12px;overflow-wrap:anywhere}.method-note{background:#e8ebdf;border:1px solid var(--line);padding:23px 28px;font-size:12px;margin-top:22px}.method-note p{margin:5px 0}.footer{margin-top:35px;padding:25px 0 40px;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}[hidden]{display:none!important}.empty{font-size:13px;color:var(--muted)}
@media(max-width:760px){.wrap{padding:0 20px}.hero{grid-template-columns:1fr;gap:28px;padding-top:40px}.meta{max-width:100%}h1{letter-spacing:-2px}.grid{grid-template-columns:1fr}.metrics{grid-template-columns:1fr 1fr}.metric:nth-child(3){border-left:0;padding-left:0}.metric strong{font-size:36px}.toolbar,.section-head{align-items:start;flex-direction:column}.toolbar{gap:15px}.actions{flex-wrap:wrap}.section-head{gap:0}.fields{gap:15px}.event summary{gap:10px;flex-wrap:wrap}.event-kind{width:70px}.event summary strong{overflow-wrap:anywhere}.byline{font-size:10px}.footer{gap:20px}.card-top{flex-wrap:wrap}}
@media print{body{background:white}.wrap{max-width:none;padding:0}.top .wrap{padding-top:0}.hero{padding-top:30px;gap:35px}.toolbar,.flow{display:none}.grid{display:block}.decision,.claim{break-inside:avoid;margin-bottom:20px}.event{break-inside:avoid}.hero h1{font-size:46px}.method-note{background:white}.top,.footer{color:black}.searchable[hidden]{display:block!important}}
</style></head><body>
<header class="top"><div class="wrap"><a class="brand" href="#">Civ<span>OS</span></a><span class="byline">Kris Ledel · Local prototype 0.2</span></div></header>
<main class="wrap"><div class="hero"><div><span class="eyebrow">Evidence / accountability / revision</span><h1>Decisions you<br>can <span>inspect.</span></h1><p class="intro">Follow each decision back to its claims, evidence and dissent — then forward to what happened.</p></div><div class="meta"><span class="eyebrow">Verified local ledger</span><p>Record structure and hash chain verified before export. This report does not authenticate authors or validate their claims.</p><span class="eyebrow">Review clock</span><p>{{CLOCK}}</p><span class="eyebrow">Ledger head / SHA-256</span><p class="hash">{{HEAD}}</p></div></div>
{{DEMO_NOTICE}}<div class="flow" aria-label="Record relationships"><span>01 CLAIM</span><b>→</b><span>02 EVIDENCE</span><b>→</b><span>03 ASSESSMENT</span><b>→</b><span>04 DECISION</span><b>→</b><span>05 OUTCOME</span></div>
<div class="metrics"><div class="metric"><strong>{{RECORDS}}</strong><span>Records in full history</span></div><div class="metric attention"><strong>{{DISPUTED}}</strong><span>Current claims with a dispute</span></div><div class="metric"><strong>{{DECISIONS}}</strong><span>Current decisions</span></div><div class="metric attention"><strong>{{OVERDUE}}</strong><span>Reviews overdue without an outcome</span></div></div>
<div class="toolbar"><label class="search" for="search">Search this report<input id="search" type="search" placeholder="Claim, owner, evidence, decision…"></label><div class="actions"><label class="filter"><input id="attention" type="checkbox">Items needing review</label><button id="reset" type="button">Reset</button><button id="print" type="button">Print</button></div></div>
<p id="result-count" class="empty" aria-live="polite"></p>
<section><div class="section-head"><h2>01 / Decisions & follow-up</h2><p>Responsibility remains with the named owner.</p></div><div class="grid">{{DECISION_CARDS}}</div></section>
<section><div class="section-head"><h2>02 / Claims & disagreement</h2><p>Support and dispute remain separate records.</p></div><div class="grid">{{CLAIM_CARDS}}</div></section>
<section><div class="section-head"><h2>03 / Complete record</h2><p>Open any entry to inspect its original fields.</p></div>{{HISTORY}}</section>
<aside class="method-note"><p><strong>How to read this report.</strong> A dispute flag means a current evidence record or assessment challenges a claim. No dispute recorded does not mean verified. Counts describe records, not independent sources, votes or probabilities.</p><p>The review clock only evaluates deadlines against the complete exported ledger; it does not reconstruct a historical snapshot. A recorded outcome documents follow-up; it does not close a decision automatically. Revised records stay in the history, and existing references keep their original targets.</p><p>Anyone with write access to the database can replace it and recompute its hashes. Keep a trusted head hash separately to check an exact snapshot. Source links are references and have not been fetched or authenticated by this report.</p></aside>
</main><footer class="wrap"><div class="footer"><span>CivOS · Kris Ledel</span><span>Portable records. Visible dissent. Explicit follow-up.</span></div></footer>
<script>
const search=document.getElementById('search'),attention=document.getElementById('attention'),items=[...document.querySelectorAll('.searchable')];
function filter(){const q=search.value.toLocaleLowerCase();let visible=0;items.forEach(item=>{item.hidden=!(item.textContent.toLocaleLowerCase().includes(q)&&(!attention.checked||item.dataset.attention==='true'));if(!item.hidden)visible++});document.getElementById('result-count').textContent=(q||attention.checked)?visible+' matching entries':''}
search.addEventListener('input',filter);attention.addEventListener('change',filter);
document.getElementById('reset').addEventListener('click',()=>{search.value='';attention.checked=false;filter();search.focus()});
document.getElementById('print').addEventListener('click',()=>window.print());
function reveal(){if(!location.hash)return;const target=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(target){search.value='';attention.checked=false;filter();if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView({block:'start'})}}
window.addEventListener('hashchange',reveal);reveal();
</script></body></html>'''
