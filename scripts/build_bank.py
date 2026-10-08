"""Reproducible public compilation: immutable imported baseline + reviewed local patches.
No private course workspace required. Run python3 scripts/build_bank.py.
"""
from pathlib import Path
import copy, hashlib, json, html, re
ROOT = Path(__file__).resolve().parents[1]
def digest(v): return hashlib.sha256(json.dumps(v, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
def dump(path, data): path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
def build():
    bank=json.loads((ROOT/'sources/bank.original.json').read_text())
    revisions=json.loads((ROOT/'sources/revisions.json').read_text())
    audit=json.loads((ROOT/'sources/question-audit.json').read_text())
    original_version=bank['bankVersion']; bank['compatibleBankVersions']=[original_version];bank['contentHistory']=[]
    original_hashes={q['id']:q['contentHash'] for q in bank['questions']}
    for q in bank['questions']:
        if q['id'] not in audit: raise ValueError('Missing audit entry: '+q['id'])
        entry=audit[q['id']]
        if entry['status'] not in ['retained','rewritten','unresolved']: raise ValueError('Incomplete audit: '+q['id'])
        q['qualityReview'] = entry
        if q['id'] not in revisions: continue
        revision=revisions[q['id']];old=copy.deepcopy(q)
        for k in revision.get('remove',[]): q.pop(k,None)
        q.update(copy.deepcopy(revision['patch']))
        if revision['material']:
            historical={k:old[k] for k in ['id','type','options','correct','contentHash']}
            for k in ['rows','selectCount']: 
                if k in old:historical[k]=old[k]
            bank['contentHistory'].append(historical)
            content={k:q.get(k) for k in ['stem','type','code','options','rows','correct','selectCount','context','caseId']}
            q['contentHash']=digest(content)
            # Rewritten scenarios are no longer the old near-duplicate variant.
            q['variantId']=q['groupId']+'~'+q['contentHash'][:10]
        q['localRevision']={'date':revision.get('date','2026-10-07'),'material':revision['material'],'reason':revision['reason'],'originalContentHash':old['contentHash']}
        q['explanationAuthor'] = 'Local study revision · original source credited'
        q['sources']=[r['url'] for r in q.get('references',[]) if r['url'].startswith('https://')]
    bank['qualityCounts']={key:sum(a['status']==key for a in audit.values()) for key in ['rewritten','retained','unresolved']}
    bank['classifiedAt']=max(['2026-10-07']+[q['localRevision']['date'] for q in bank['questions'] if q.get('localRevision')])
    variants={}
    for q in bank['questions']:
        variants.setdefault(q['variantId'],{'id':q['variantId'],'groupId':q['groupId'],'questionIds':[]})['questionIds'].append(q['id'])
    bank['variants']=list(variants.values())
    bank['materialRevisionCount']=sum(r['material'] for r in revisions.values())
    publishing=next(g for g in bank['groups'] if g['id']=='08/publishing')
    publishing['rule']='Legacy Agent Application publishing requires at least Foundry Project Manager at Foundry resource scope. Check the publishing model before applying this rule to new endpoints.'
    versions=next(g for g in bank['groups'] if g['id']=='07/versions')
    versions['cue']='Retired preview vs current config.workflow="agentic"'
    versions['rule']='Pin the API version. Current agentic reasoning uses config.workflow="agentic" in its documented preview contract; unverifiable retired standard/pro items are unscored.'
    search=next(g for g in bank['groups'] if g['id']=='08/search')
    search['rule']='Search Index Data Reader queries documents; Index Data Contributor also writes/deletes documents; Search Service Contributor manages Search objects. Choose the narrow data role for the requested operation.'
    bank['bankVersion']='topics-2026-10-07-'+digest(revisions)[:12]
    # Persist known version lineage in source, including draft-only records and later edits.
    # Never discard a historical definition when rebuilding from the immutable baseline.
    lineage_path=ROOT/'sources/content-history.json'
    lineage=json.loads(lineage_path.read_text()) if lineage_path.exists() else {'banks':{},'definitions':[]}
    lineage['banks'][original_version]=original_hashes
    previous_path=ROOT/'data/bank.json'
    if previous_path.exists():
        previous=json.loads(previous_path.read_text())
        if previous['bankVersion']!=bank['bankVersion']:
            lineage['banks'][previous['bankVersion']]={q['id']:q['contentHash'] for q in previous['questions']}
            current={q['id']:q for q in bank['questions']}
            for q in previous['questions']:
                if q['id'] in current and q['contentHash']!=current[q['id']]['contentHash']:
                    lineage['definitions'].append({k:q[k] for k in ['id','type','options','correct','contentHash','stem','rows','selectCount','code'] if k in q})
            lineage['definitions'].extend(previous.get('contentHistory',[]))
    definitions={ (q['id'],q['contentHash']):q for q in bank['contentHistory']+lineage['definitions'] }
    lineage['definitions']=list(definitions.values());dump(lineage_path,lineage)
    bank['contentHistory']=lineage['definitions']
    bank['compatibleBankVersions']=sorted(v for v in lineage['banks'] if v!=bank['bankVersion'])
    bank['migrationBanks']=lineage['banks']
    for group in bank['groups']:
        group['scoredQuestionCount']=sum(q.get('scored',True) is not False for q in bank['questions'] if q['groupId']==group['id'])
    blueprint=json.loads((ROOT/'sources/exam-blueprint.json').read_text())
    domain_ids={d['id'] for d in blueprint['domains']}
    missing={q['id'] for q in bank['questions'] if not q.get('domain')}
    if missing != set(blueprint['additionalAssignments']): raise ValueError('Supplemental exam mapping must cover every guide/legacy item exactly once.')
    exhibits=set(blueprint['codeCompletionExhibitIds'])
    if not exhibits <= {q['id'] for q in bank['questions']}: raise ValueError('Unknown code completion exhibit.')
    for q in bank['questions']:
        q['examDomainId']=q.get('domain') or blueprint['additionalAssignments'][q['id']]
        if q['examDomainId'] not in domain_ids: raise ValueError('Invalid exam domain: '+q['id'])
        # A template token inside complete executable code is not necessarily an exercise blank.
        q['isCodeCompletion']=q['type']=='rows' and (bool(q.get('code')) or q['id'] in exhibits)
    bank['examOutline']={k:blueprint[k] for k in ['outlineUrl','skillsEffective','verifiedAt','mappingBasis']}
    bank['practiceSets']=[]
    for domain in blueprint['domains']:
        ids=[q['id'] for q in bank['questions'] if q['examDomainId']==domain['id'] and q.get('scored',True)]
        code_ids=[q['id'] for q in bank['questions'] if q['id'] in ids and q['isCodeCompletion']]
        bank['practiceSets'].append(dict(domain,kind='exam',questionIds=ids))
        bank['practiceSets'].append({'id':domain['id']+'-code','parentId':domain['id'],'kind':'exam-code','title':domain['title']+' · code completion','description':'Complete the code blanks for this exam part.','questionIds':code_ids})
    code_ids=[q['id'] for q in bank['questions'] if q['isCodeCompletion'] and q.get('scored',True)]
    bank['practiceSets'].append({'id':'code','kind':'code','title':'Code completion','description':'Complete Python, REST, JSON and configuration snippets across all exam parts. Text templates and code exhibits use the same saved answers and reasoning as topic practice.','questionIds':code_ids})
    dump(ROOT/'data/bank.json',bank)
    payload=json.dumps(bank,ensure_ascii=False).replace('</','<\\/')
    (ROOT/'data/bank.js').write_text('window.TOPIC_BANK = '+payload+';\n')
    dump(ROOT/'data/question-audit.json',audit)
    manifest=json.loads((ROOT/'data/classification-manifest.json').read_text())
    by_id={q['id']:q for q in bank['questions']}
    for item in manifest:
        q=by_id[item['id']]
        for field in ['stem','topicId','groupId','relatedGroupIds','variantId','examDomainId','isCodeCompletion']:item[field]=q[field]
        item['qualityReview']=q['qualityReview']['status'];item['scored']=q.get('scored',True)
    dump(ROOT/'data/classification-manifest.json',manifest)
    path=ROOT/'data/coverage-report.json';data=json.loads(path.read_text())
    data.update(date=bank['classifiedAt'],scoredTotal=sum(q.get('scored',True) for q in bank['questions']))
    data['scoredGroups']={g['id']:g['scoredQuestionCount'] for g in bank['groups']}
    data['variantClusters']=sum(len(v['questionIds'])>1 for v in bank['variants'])
    data['accuracy']='Every item audited; local question/feedback revisions distinguished from immutable imports. Unresolved items are explicitly unscored. Primary documentation supports technical checks; this is unofficial self-learning material, not certified examination guidance.'
    data['qualityReview']={'date':bank['classifiedAt'],'bankVersion':bank['bankVersion'],'counts':bank['qualityCounts'],'materialRevisions':bank['materialRevisionCount'],'record':'question-audit.json'}
    data['examPractice']={'outline':bank['examOutline'],'sets':{s['id']:len(s['questionIds']) for s in bank['practiceSets']},'codeCompletionBlanks':sum(len(q.get('rows',[])) for q in bank['questions'] if q['isCodeCompletion'] and q.get('scored',True))}
    dump(path,data)
    lines=['# AI-103 · Grouped question map','',f"Reviewed {bank['classifiedAt']}: **{len(bank['questions'])} questions · {data['scoredTotal']} scored · {bank['qualityCounts']['unresolved']} unresolved · {len(bank['topics'])} topics · {len(bank['groups'])} decision families**.",'',
        'Local revisions preserve original attribution. Original imports are in `sources/bank.original.json`; current stems, keys and feedback are compiled from reviewed patches. [Review report](CONTENT-REVIEW.md) · [Per-question audit](data/question-audit.json).','',
        'Learn a rule → compare credible choices → practice → mark confusion independently of your score. English questions and established Czech/English explanations retained.','']
    for topic in bank['topics']:
        lines.extend([f"## {topic['id']} · {topic['title']}",'',topic['description'],''])
        for group_id in topic['groupIds']:
            g=next(g for g in bank['groups'] if g['id']==group_id)
            lines.extend([f"### {g['title']} ({g['scoredQuestionCount']} scored)",'',f"**Recognize:** {g['cue']}",'',f"**Rule:** {g['rule']}",'',f"**Distinguish:** {g['contrast']}",'',f"[Study this family](index.html#group={g['id']})",''])
            for id in g['questionIds']:
                q=by_id[id];stem=' '.join(q['stem'].split('\n\n')[0].split())
                lines.append(f"- **{q['sourceLabel']}** (`{id}`) · {q['qualityReview']['status']} — {stem}")
            lines.append('')
    (ROOT/'GROUPED-QUESTION-MAP.md').write_text('\n'.join(lines)+'\n')
    # Synchronize the existing guide's family summaries without replacing authored prose.
    for file in (ROOT/'guides').glob('*.html'):
        text=file.read_text()
        for g in bank['groups']:
            pattern=r'(<li><a href="\.\./index\.html#group='+re.escape(g['id'])+r'">[^<]+</a>) — \d+ questions\. [^<]+</li>'
            text=re.sub(pattern,lambda m:m[1]+f" — {g['scoredQuestionCount']} scored questions. "+html.escape(g['rule'])+'</li>',text)
        file.write_text(text)
    print(bank['bankVersion'],len(bank['questions']),bank['qualityCounts'])
if __name__=='__main__':build()
