"""Deterministic offline candidates for sets 2/3. Never runs in the shipped game.
Preserves the first 30 records. Selection metrics describe structure, not human difficulty.
Run: python3 tools/author-bank.py; then npm run check and render/playtest the bank.
"""
import hashlib
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RNG = random.Random(20261031)

def canonical(l):
    variants = []
    for flip in [-1, 1]:
        for rotation in range(4):
            points = []
            for c in l['cells']:
                x, y = c % l['width'] * flip, c // l['width']
                for _ in range(rotation):
                    x, y = -y, x
                points.append((x, y))
            xx, yy = min(x for x, y in points), min(y for x, y in points)
            variants.append(tuple(sorted((x-xx, y-yy) for x, y in points)))
    return min(variants)

def enumerate_routes(w, cells, start, cap=100, budget=150000):
    neighbors = {c: [n for n in cells if abs(c%w-n%w)+abs(c//w-n//w)==1] for c in cells}
    for ns in neighbors.values(): RNG.shuffle(ns)
    route, used, result = [start], {start}, []
    nodes = 0
    def visit(head):
        nonlocal nodes
        nodes += 1
        if nodes > budget or len(result) >= cap: return
        if len(route) == len(cells): result.append(route[:]); return
        reachable, queue = {head}, [head]
        for c in queue:
            for n in neighbors[c]:
                if n not in used and n not in reachable:
                    reachable.add(n);queue.append(n)
        if len(reachable) != len(cells)-len(used)+1: return
        leaves=0
        for c in reachable:
            if c==head: continue
            degree=sum(n in reachable for n in neighbors[c])
            if degree==0: return
            if degree==1: leaves+=1
        if leaves>1: return
        for n in neighbors[head]:
            if n in used: continue
            route.append(n);used.add(n);visit(n);used.remove(n);route.pop()
    visit(start)
    return result, nodes, nodes <= budget and len(result) < cap

def legal(l, route, omit=None):
    if omit!='finish' and 'finish' in l and route[-1]!=l['finish']: return False
    edges={tuple(sorted(e)) for e in zip(route,route[1:])}
    if omit!='walls' and any(tuple(sorted(e)) in edges for e in l.get('walls',[])):return False
    positions=[route.index(c) for c in l.get('checkpoints',[])]
    if omit!='checkpoints' and positions!=sorted(positions):return False
    return True

def candidate(size, expert):
    w,h=RNG.choice([(4,5),(5,4),(5,5),(6,4),(5,6),(6,5),(6,6)] if expert else [(4,4),(4,5),(5,4),(5,5),(6,4),(5,6)])
    size=min(size,w*h-1)
    route=[RNG.randrange(w*h)];used=set(route)
    for _ in range(size-1):
        c=route[-1];ns=[n for n in [c-1,c+1,c-w,c+w] if 0<=n<w*h and abs(c%w-n%w)+abs(c//w-n//w)==1 and n not in used]
        if not ns:return None
        n=RNG.choice(ns);route.append(n);used.add(n)
    minx,miny=min(c%w for c in used),min(c//w for c in used)
    width=max(c%w for c in used)-minx+1;height=max(c//w for c in used)-miny+1
    if width<4 or height<3 or size/(width*height)<.68:return None
    cells=sorted((c//w-miny)*width+c%w-minx for c in used)
    route=[(c//w-miny)*width+c%w-minx for c in route]
    branches=sum(sum(abs(c%width-n%width)+abs(c//width-n//width)==1 for n in cells)>=3 for c in cells)
    if branches < (7 if expert else 4):return None
    turns=sum(route[i]-route[i-1]!=route[i+1]-route[i] for i in range(1,len(route)-1))
    if turns<len(cells)*.35:return None
    return dict(width=width,height=height,cells=cells,start=route[0],witness=route),branches,turns

def main():
    file=ROOT/'src/content/levels.ts';s=file.read_text();base=json.loads(s[s.index('= ')+2:].strip().removesuffix(';'))[:30]
    shapes={canonical(l) for l in base}; added=[];audit=[];attempts=0
    families=[(),('finish',),('walls',),('checkpoints',),('finish','walls'),('walls','checkpoints')]
    expert_families=[('walls',),('checkpoints',),('finish','checkpoints'),('finish','walls'),('walls','checkpoints'),('finish','walls','checkpoints')]
    for set_id,expert in [('turns',False),('shapes',True)]:
        for index in range(30):
            family=(expert_families if expert else families)[index//5]
            # Breathers at each five-level chapter, then modest increases in area.
            target=(22 if expert else 16)+(index%5)+(index//10)*2
            for attempt in range(12000):
                attempts+=1;c=candidate(target,expert)
                if c is None:continue
                level,branches,turns=c;shape=canonical(level)
                if shape in shapes:continue
                pool,nodes,exhaustive=enumerate_routes(level['width'],level['cells'],level['start'])
                if len(pool)<(3 if family else 2):continue
                chosen=None
                for _ in range(45):
                    route=RNG.choice(pool);l={**level,'witness':route}
                    if 'finish' in family:l['finish']=route[-1]
                    if 'walls' in family:
                        w=l['width'];edges={tuple(sorted(e)) for e in zip(route,route[1:])}
                        possible=[(a,b) for a in l['cells'] for b in l['cells'] if a<b and abs(a%w-b%w)+abs(a//w-b//w)==1 and (a,b) not in edges]
                        if not possible:continue
                        l['walls']=[list(e) for e in RNG.sample(possible,min(len(possible),1+(index%5>=2)+(expert and index%5>=3)))]
                    if 'checkpoints' in family:
                        n=5 if expert and index>=15 else 4
                        positions=sorted(RNG.sample(range(2,len(route)-2),n-1))
                        if any(b-a<2 for a,b in zip([0]+positions,positions)):continue
                        l['checkpoints']=[route[i] for i in [0]+positions]
                    valid=[p for p in pool if legal(l,p)]
                    if not valid or (family and len(valid)==len(pool)):continue
                    counterexamples={f:next((p for p in pool if legal(l,p,omit=f) and not legal(l,p)),None) for f in family}
                    if any(v is None for v in counterexamples.values()):continue
                    score=(abs(len(valid)-(2 if expert else 4)), -turns)
                    if chosen is None or score<chosen[0]:chosen=(score,l,counterexamples,len(valid))
                if chosen is None:continue
                _,l,counterexamples,count=chosen
                l.update(id=f'{set_id}-{index+1:02d}',version=1,tag='mixed' if len(family)>1 else family[0] if family else 'classic',origin='Road Lines deterministic offline authoring, seed 20261031; independently validated')
                shapes.add(shape);added.append(l)
                audit.append(dict(id=l['id'],cells=len(l['cells']),branches=branches,turns=turns,sampledClassicSolutions=len(pool),sampledRuleSolutions=count,enumerationExhaustive=exhaustive,searchNodes=nodes,counterexamples=counterexamples,maskHash=hashlib.sha256(repr(shape).encode()).hexdigest()[:16]))
                print(l['id'],len(l['cells']),family,'solutions',count,'/',len(pool),flush=True);break
            else:raise RuntimeError(('No suitable candidate',set_id,index))
    file.write_text("import type { Level } from '../core/model';\n\nexport const levels: readonly Level[] = "+json.dumps(base+added,ensure_ascii=False,indent=2)+';\n')
    (ROOT/'docs/BANK_CONTENT_AUDIT.json').write_text(json.dumps(dict(seed=20261031,attempts=attempts,levels=audit,legacy30Sha256=hashlib.sha256(json.dumps(base,ensure_ascii=False,separators=(',', ':')).encode()).hexdigest()),ensure_ascii=False,indent=2)+'\n')
    print('Selected',len(added),'different masks in',attempts,'walk attempts.')
if __name__=='__main__':main()
