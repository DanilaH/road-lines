#!/usr/bin/env python3
"""Offline design scenarios, not player telemetry or a revenue forecast.
Run from repository root: python3 tools/monetization-model.py
Reads runtime source without importing/mutating the app. Writes research evidence.
"""
import hashlib
import json
import math
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def read(p): return (ROOT / p).read_text()
save = read('src/services/save.ts')
rewards = read('src/core/rewards.ts')
themes = read('src/content/themes.ts')
levels = json.loads(read('src/content/levels.ts').split('= ', 1)[1].rsplit(';', 1)[0])
initial_hints = int(re.search(r'coins: 0, hints: (\d+)', save)[1])
base = int(re.search(r'coins: this.state.coins \+ \(first \? (\d+) : 0', save)[1])
gift_every = int(re.search(r'Math.floor\(completed / (\d+)\)', rewards)[1])
gift_value = int(re.search(r'\(milestones - granted\) \* (\d+)', rewards)[1])
prices = [int(n) for n in re.findall(r"id: '[^']+', price: (\d+)", themes)]
wheel = [int(n) for n in re.search(r'wheelPrizes = \[([^\]]+)\]', rewards)[1].split(',')]
assert len(levels) == 90 and initial_hints == 3 and base == 20
assert prices == [0, 0, 500, 500, 500, 500, 500, 500]
assert wheel == [20, 30, 50, 75, 100, 150, 200, 300]
assert gift_every == 20 and gift_value == 100
source_paths = ['src/services/save.ts', 'src/core/rewards.ts', 'src/content/themes.ts', 'src/content/levels.ts']
source = {p: hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in source_paths}

# Hypothetical uses of a partial, three-next-cell hint. Not measured frequencies.
profiles = {
    'independent': [0, 0, 0],
    'light': [1, 4, 7],
    'moderate': [3, 10, 17],
    'frequent': [8, 20, 32],
    'stress': [20, 40, 60],
}

def run_profile(counts, pack_price, reward, theme_levels=(), single=False):
    balance = 0; stock = initial_hints; hint_cost = 0; videos = 0
    earned = 0; hints_used = 0; bought = 0; owned = 0; theme_delays = []
    schedule = {}; pending_themes = 0
    for block, count in enumerate(counts):
        # All hints must be affordable BEFORE the reward for the current clear.
        for i in range(count):
            n = block * 30 + 1 + (i * 30 // count)
            schedule[n] = schedule.get(n, 0) + 1
    for n in range(1, len(levels)+1):
        for _ in range(schedule.get(n, 0)):
            if stock == 0:
                cost, amount = (60, 1) if single else (pack_price, 3)
                while balance < cost:
                    balance += reward; videos += 1
                balance -= cost; hint_cost += cost; stock += amount; bought += amount
            stock -= 1; hints_used += 1
        value = base + (gift_value if n % gift_every == 0 else 0)
        balance += value; earned += value
        if n in theme_levels: pending_themes += 1
        # Cosmetics use earned/surplus balance only, never force ad viewing.
        while pending_themes and balance >= 500:
            balance -= 500; owned += 1; pending_themes -= 1; theme_delays.append(n)
    assert balance >= 0 and stock >= 0
    assert earned + videos*reward == balance + hint_cost + owned*500
    return {'hintsUsed':hints_used,'paidHintsBought':bought,'hintCoinsSpent':hint_cost,
            'rewardedViewsIfEveryRequestedHintIsUsed':videos,'coinsLeft':balance,
            'hintsLeft':stock,'themesBought':owned,'themePurchaseLevels':theme_delays,
            'unfulfilledThemeWishes':pending_themes}

# Two distinct results: terminal resource lower bound vs chronological cashflow.
def terminal(count, pack_price, theme_count):
    need = max(0, count-initial_hints)
    packs = math.ceil(need/3)
    earned = 90*base+4*gift_value
    cost = packs*pack_price+theme_count*500
    return {'uses':count,'themes':theme_count,'packCost':packs*pack_price,
            'resourceDeficit':max(0,cost-earned),'minimum150CoinViewsIgnoringTiming':math.ceil(max(0,cost-earned)/150),
            'surplusBeforeVideos':earned-cost}

# Exact finite distribution for one free spin/day, no theme purchases/spending.
# A theme sector grants a different unowned theme until all six are owned.
def wheel_projection(days, initial_owned=0):
    states = {initial_owned:(1.0,0.0)} # (probability, probability-weighted accumulated coins)
    coin_ev = sum(wheel[:7])/8
    for _ in range(days):
        nxt={}
        for k,(p,c) in states.items():
            a,b=nxt.get(k,(0.0,0.0))
            nxt[k]=(a+p*7/8,b+c*7/8+p*coin_ev)
            j=min(6,k+1); extra=wheel[7] if k==6 else 0
            a,b=nxt.get(j,(0.0,0.0))
            nxt[j]=(a+p/8,b+c/8+p*extra/8)
        states=nxt
    assert abs(sum(p for p,c in states.values())-1)<1e-10
    return {'days':days,'initialPaidThemesOwned':initial_owned,
            'expectedCoins':sum(c for p,c in states.values()),
            'expectedNewThemes':sum((k-initial_owned)*p for k,(p,c) in states.items()),
            'probabilityAtLeastOneNewTheme':sum(p for k,(p,c) in states.items() if k>initial_owned),
            'themeCountDistribution':{str(k):p for k,(p,c) in states.items()}}

# Eligibility only, perfect fill/show and no rewarded views; assumes a single continuous session.
# Active seconds EXCLUDE ad time/background. No claim these solve times are real.
def cadence(seconds_per_clear, policy):
    shown=[]; last_t=0; last_n=0; skips=[]
    grace_n,grace_t,gap_n,gap_t,rolling=policy
    for n in range(1,90):
        t=n*seconds_per_clear
        if n<grace_n or t<grace_t or n-last_n<gap_n or t-last_t<gap_t: continue
        if n%20==0: skips.append(n); continue
        if rolling is not None and sum(t-s < 600 for _,s in shown)>=rolling: continue
        shown.append((n,t)); last_t=t; last_n=n
    return {'assumedActiveSecondsPerClear':seconds_per_clear,'campaignActiveMinutes':90*seconds_per_clear/60,
            'eligibleShows':len(shown),'showLevels':[n for n,t in shown],
            'protectedGiftTransitionsSkipped':skips,
            'first10ActiveMinutes':sum(t<=600 for n,t in shown)}

out={
 'date':'2026-11-02','kind':'design sensitivity analysis, not telemetry; no SDK/runtime changes',
 'runtimeCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
 'sourceSha256':source,
 'current':{'levels':len(levels),'initialHints':initial_hints,'baseCoins':base,'giftEvery':gift_every,
            'giftCoins':gift_value,'campaignCoins':90*base+4*gift_value,'themePrices':prices,
            'paidCatalogCoins':sum(prices),'wheelPrizesLegacy':wheel},
 'recommendationCandidate':{'hintSingle':60,'hintPackCount':3,'hintPackCoins':150,'rewardedTopup':150,
             'note':'proposal only, replaces earlier ad routes only if approved; earned balances unchanged'},
 'terminalNoWheel':[terminal(sum(v),150,t) for v in profiles.values() for t in [0,1,3]],
 'chronologicalNoWheel':{k:run_profile(v,150,150) for k,v in profiles.items()},
 'chronologicalOneThemeWishAt20NoWheel':{k:run_profile(v,150,150,(20,)) for k,v in profiles.items()},
 'sensitivityNoWheel':[
     {'packPrice':p,'topup':r,'profiles':{k:run_profile(v,p,r) for k,v in profiles.items()}}
     for p,r in [(90,150),(150,80),(150,150),(240,150)]],
 'singleHintOnlyNoWheel':{k:run_profile(v,150,150,single=True) for k,v in profiles.items()},
 'wheelNoPurchases':[wheel_projection(d,o) for d in [1,7,30] for o in [0,6]],
 'wheelFirstSpin':{'coinExpectationUnowned':sum(wheel[:7])/8,'themeChance':1/8,
                  'coinExpectationAllOwned':sum(wheel)/8,'themeRetailEquivalent':500/8,
                  'note':'retail equivalent is not cash or player willingness-to-pay'},
 'x5Stress':{'bonusPerView':80,'views':90,'bonusCoins':90*80,'campaignPlusBonus':2200+90*80},
 'cadence':{'candidate':[cadence(s,(10,180,4,150,3)) for s in [8,25,60]],
            'legacy':[cadence(s,(6,0,3,90,None)) for s in [8,25,60]],
            'limits':'No ad duration/retention/fill modeled; gifts protected; rewarded suppresses later interstitials in real policy. Candidate grace and full-screen cooldown must persist across restart.'},
 'revenue':{'formula':'revenue = displayedImpressions / 1000 * observed publisher eCPM',
            'notForecast':True,'sensitivityFor10000DisplayedImpressions':[{'hypotheticalEcpmRub':e,'grossRub':10*e} for e in [100,300,600]],
            'limits':'arbitrary sensitivity inputs, NOT measured rates; no fill, tax, retention or traffic forecast'}
}
# Regression checks on scenario accounting and exact expected values.
assert out['current']['campaignCoins']==2200 and out['current']['paidCatalogCoins']==3000
assert out['wheelFirstSpin']['coinExpectationUnowned']==78.125
assert out['wheelFirstSpin']['coinExpectationAllOwned']==115.625
assert abs(wheel_projection(7)['probabilityAtLeastOneNewTheme']-(1-(7/8)**7))<1e-12
for group in out['cadence'].values():
    if isinstance(group,list):
        for r in group: assert all(n%20 and n<90 for n in r['showLevels'])
path=ROOT/'docs/research/MONETIZATION_MODEL_2026-11-02.json'
path.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:out[k] for k in ['current','chronologicalNoWheel','chronologicalOneThemeWishAt20NoWheel','wheelFirstSpin','cadence']},ensure_ascii=False,indent=2))
