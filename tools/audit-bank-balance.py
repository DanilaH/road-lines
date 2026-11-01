"""Independent offline audit. Uniform legal-move probability is NOT human difficulty.
No imports of game model/solver, no dependencies, no mutation of level records.
"""
import collections, functools, hashlib, json, math, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
text = (ROOT/'src/content/levels.ts').read_text()
levels = json.loads(text[text.index('= ')+2:].strip().rstrip(';'))
OUT = ROOT/'.test-output/balance-audit'; OUT.mkdir(parents=True, exist_ok=True)
class Budget(Exception): pass

def analyze(level, index):
    cells = level['cells']; n = len(cells); ids = {c:i for i,c in enumerate(cells)}; bits = [1<<i for i in range(n)]; full=(1<<n)-1
    walls={frozenset(e) for e in level.get('walls', [])}
    ns = [[j for j,b in enumerate(cells) if abs(a%level['width']-b%level['width'])+abs(a//level['width']-b//level['width'])==1 and frozenset((a,b)) not in walls] for a in cells]
    masks=[sum(bits[j] for j in row) for row in ns]
    checkpoints=[ids[c] for c in level.get('checkpoints',[])]; finish=ids.get(level.get('finish')); start=ids[level['start']]
    def children(mask,head):
        next_cp=next((c for c in checkpoints if not mask & bits[c]),None)
        return [c for c in ns[head] if not mask&bits[c] and (c!=finish or mask.bit_count()==n-1) and (c not in checkpoints or c==next_cp)]
    def feasible(mask, head):
        remaining=(full^mask)|bits[head]; seen=bits[head]; frontier=seen
        while frontier:
            b=frontier & -frontier; frontier-=b; j=b.bit_length()-1
            add=masks[j]&remaining&~seen; frontier|=add; seen|=add
        if seen!=remaining: return False
        leaves=0
        for j in range(n):
            if j==head or not remaining&bits[j]:continue
            degree=(masks[j]&remaining).bit_count()
            if degree==0:return False
            if degree==1:
                leaves+=1
                if leaves>1 or (finish is not None and j!=finish):return False
        return True
    visited=0; begun=time.perf_counter()
    @functools.lru_cache(None)
    def solve(mask, head):
        nonlocal visited
        visited+=1
        if visited>500_000 or (visited%4096==0 and time.perf_counter()-begun>12): raise Budget()
        if mask==full:return (int(finish is None or head==finish),float(finish is None or head==finish))
        if not feasible(mask,head):return (0,0.0)
        cs=children(mask,head)
        values=[solve(mask|bits[c],c) for c in cs]
        return (sum(x[0] for x in values),sum(x[1] for x in values)/len(cs) if cs else 0.0)
    row={'index':index+1,'id':level['id'],'cells':n,'rules': [k for k in ['finish','walls','checkpoints'] if level.get(k) is not None], 'exact':False}
    try:
        count,prob=solve(bits[start],start)
        assert count>0, level['id']
        row.update(exact=True,solutions=count,uniformLegalWalkWinProbability=prob,uniformLegalWalkSurpriseBits=-math.log2(prob) if prob else None)
        witness=level['witness']; mask=bits[start]; forced=0; decisions=[]; traps=[]
        for step,head_cell in enumerate(witness[:-1]):
            head=ids[head_cell]; cs=children(mask,head); viable=[c for c in cs if solve(mask|bits[c],c)[0]>0]
            assert ids[witness[step+1]] in viable
            forced+=len(cs)==1
            if len(cs)>1: decisions.append({'prefixLength':step+1,'legal':len(cs),'viable':len(viable)})
            for c in cs:
                if c not in viable:
                    traps.append({'prefix':witness[:step+1]+[cells[c]],'cheapConnectivityDegreeReject':not feasible(mask|bits[c],c)})
            mask |= bits[ids[witness[step+1]]]
        row.update(witnessForcedMoves=forced,witnessDecisionPoints=len(decisions),witnessSafeChoices=sum(d['viable']>1 for d in decisions),decisions=decisions,trapEdgesOnWitness=len(traps),nonlocalTrapEdgesOnWitness=sum(not t['cheapConnectivityDegreeReject'] for t in traps),trapExamples=sorted(traps,key=lambda t:t['cheapConnectivityDegreeReject'])[:3])
        # A long, legal but unsolvable route, chosen using oracle only for test fixture creation.
        if traps:
            p=traps[0]['prefix'][:]; used=sum(bits[ids[c]] for c in p)
            while True:
                cs=children(used,ids[p[-1]])
                if not cs:break
                c=max(cs,key=lambda c:sum(not (used|bits[c])&bits[j] for j in ns[c]))
                p.append(cells[c]);used|=bits[c]
            valid_lengths=[];used=0
            for k,c in enumerate(p):
                used|=bits[ids[c]]
                if solve(used,ids[c])[0]>0:valid_lengths.append(k+1)
            row['deadEndExample']={'prefix':p,'nearestSolvablePrefixLength':max(valid_lengths)}
    except Budget:
        row['budgetReached']=True
    row.update(searchStates=visited,elapsedMs=round((time.perf_counter()-begun)*1000,2))
    colors=[(int(i==start),int(i==finish),checkpoints.index(i)+1 if i in checkpoints else 0) for i in range(n)]
    return row,(ns,colors)

def wl(graph):
    ns,attrs=graph; labels=[str((a,len(ns[i]))) for i,a in enumerate(attrs)]
    for _ in range(6):labels=[hashlib.sha256((labels[i]+'|'+str(sorted(labels[j] for j in ns[i]))).encode()).hexdigest() for i in range(len(ns))]
    return labels

def isomorphic(a,b):
    aa,ac=a;bb,bc=b
    if len(aa)!=len(bb):return False
    al=wl(a);bl=wl(b)
    if sorted(al)!=sorted(bl):return False
    candidates={i:[j for j in range(len(bb)) if al[i]==bl[j]] for i in range(len(aa))}; mapping={}; used=set()
    def match():
        if len(mapping)==len(aa):return True
        i=min((i for i in range(len(aa)) if i not in mapping),key=lambda i:(-sum(k in mapping for k in aa[i]),len(candidates[i])))
        for j in candidates[i]:
            if j in used or any((k in aa[i])!=(v in bb[j]) for k,v in mapping.items()):continue
            mapping[i]=j;used.add(j)
            if match():return True
            used.remove(j);del mapping[i]
        return False
    return match()

rows=[]; graphs=[]
for i,l in enumerate(levels):
    row,graph=analyze(l,i); rows.append(row); graphs.append(graph)
    print(l['id'],row.get('solutions','UNKNOWN'),row.get('witnessDecisionPoints','?'),row['searchStates'],flush=True)
    (OUT/'results.json').write_text(json.dumps({'sourceSha256':hashlib.sha256(text.encode()).hexdigest(),'method':'Independent exact bitmask DP with safe residual connectivity/degree pruning. Probability = uniformly choose among legal next cells, not a human model. Structural duplicates = exact graph isomorphism with start/finish/checkpoint node colors; excludes visual geometry.','levels':rows},indent=2))
groups=[]
for i,graph in enumerate(graphs):
    for group in groups:
        if isomorphic(graph,graphs[group[0]]):group.append(i);break
    else:groups.append([i])
report=json.loads((OUT/'results.json').read_text());report['structurallyEquivalentGroups']=[[levels[i]['id'] for i in g] for g in groups if len(g)>1]
report['summary']={'levels':len(rows),'exact':sum(r['exact'] for r in rows),'uniqueSolution':sum(r.get('solutions')==1 for r in rows),'noWitnessDecision':sum(r.get('witnessDecisionPoints')==0 for r in rows)}
(OUT/'results.json').write_text(json.dumps(report,indent=2)+'\n')
print(report['summary']);print('Structural groups:',report['structurallyEquivalentGroups'])

# Control enumerator: plain route/set DFS, no bitmasks, memoization or pruning.
ls=levels;results=report;control=[]
for l,row in zip(ls,results['levels']):
 ns={c:[b for b in l['cells'] if abs(c%l['width']-b%l['width'])+abs(c//l['width']-b//l['width'])==1 and [c,b] not in l.get('walls',[]) and [b,c] not in l.get('walls',[])] for c in l['cells']};path=[l['start']];used=set(path);nodes=[0];begun=time.perf_counter()
 def brute():
  nodes[0]+=1
  if nodes[0]>5_000_000:raise RuntimeError('budget')
  if len(path)==len(l['cells']):return (int(l.get('finish',path[-1])==path[-1]),float(l.get('finish',path[-1])==path[-1]))
  checkpoint=next((c for c in l.get('checkpoints',[]) if c not in used),None)
  candidates=[c for c in ns[path[-1]] if c not in used and (c!=l.get('finish') or len(path)==len(l['cells'])-1) and (c not in l.get('checkpoints',[]) or c==checkpoint)]
  count=0;prob=0
  for c in candidates:
   path.append(c);used.add(c);a,b=brute();count+=a;prob+=b;used.remove(c);path.pop()
  return count,prob/len(candidates) if candidates else 0
 try:
  count,prob=brute();assert count==row['solutions'],(l['id'],count,row['solutions']);assert abs(prob-row['uniformLegalWalkWinProbability'])<1e-12
  control.append({'id':l['id'],'count':count,'nodes':nodes[0],'match':True});print(l['id'],count,nodes[0],flush=True)
 except RuntimeError:control.append({'id':l['id'],'budgetReached':True})

report['unprunedControl']=control
assert all(r.get('match') for r in control), 'Control budget exceeded: exact verification incomplete'
(OUT/'results.json').write_text(json.dumps(report,indent=2)+'\n')
