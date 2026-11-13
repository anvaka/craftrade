"""Session simulation, version 2 (after the round-1 sceptical review).

Changes answering the review:
  - players REACT: a 16-parameter state-dependent policy tuned by cross-entropy search (not a grid of fixed plans)
  - common random numbers for every comparison; final scores on held-out seeds with many runs
  - simple wiki-rule players and three personas are scored against the optimiser (is the loop solved by one sentence?)
  - lever tests re-optimise everything else with one lever forced (what is a lever worth to an optimiser?)
  - every headline is restated as "holds in X of N" under random +-30% changes to all numeric assumptions
  - design v2 rules: 12 waves / 3 bosses, rich nodes only in the swell, typed grounds (material family + enemy role),
    weapon type decides kill drops and matchup, one discrete camp craft, shrine as a priced route option,
    town need differs per run, depth pays more per wave, earned breakout in the last segment
STILL TRUE: this cannot measure fun. It tests for dominant strategies and dead choices under assumed numbers.
Run:  python3 session_sim2.py            (about 4 minutes)
"""
import numpy as np, itertools, sys, time

BASE = dict(
    hp0=100.0, regen=5.0, threat0=17.0, growth=1.145, boss=1.45,
    power0=20.0, auto=4.0, craft_gain=0.30, craft_cost=9.0, breakout=1.8, breakout_crafts=2,
    y0=10.0, yg=1.85, deep_bonus=1.5, lull_yield=0.25, kill_yield=0.30,
    heat_lull=0.03, heat_swell=0.11, heat_decay=0.6,
    adv=0.25, dis=0.20, bag_slow=0.40, bag_cap=140.0, keep=0.2,
    shrine_p=0.4, shrine_hp=0.30, shrine_value=32.0,
    dmg=1.6, chip=1.5,
)
# These values are the 13th set tried by the author; earlier sets failed more of the checks below (see reviews/tuning_log.txt).
SKILL = dict(casual=dict(m=0.85, tc=0.42, noise=0.40), regular=dict(m=1.0, tc=0.34, noise=0.33), hardcore=dict(m=1.15, tc=0.26, noise=0.26))
W, NP = 12, 16
LO = np.array([-1, 0, 0, 0, 0, 0, -2, 0, 0, 0, 0, 0, 0, 0, 0, 0], float)
HI = np.array([2, 2, 3, 1, 3, 3, 2, 3, 2, 1.2, 1.0, 1.0, 1.2, 4, 1.2, 6], float)
# a0 a1 a2 | lull | b_need b_match | c0 c1 c2 | craft: hp<d0 or wavefrac<=d1, skip if need>d2 | gate1 hp,bag | gate2 hp,bag

def simulate(theta, skill, p, n=1200, seed=0, force=None, detail=False):
    force = force or {}; sk = SKILL[skill]; rng = np.random.default_rng(seed); th = np.clip(theta, LO, HI)
    hp = np.full(n, p["hp0"]); maxhp = np.full(n, p["hp0"]); power = np.full(n, p["power0"]); heat = np.zeros(n)
    bag = np.zeros((n, 3)); schem = np.zeros(n); crafts = np.zeros(n); alive = np.ones(n, bool); done = np.zeros(n, bool)
    need = rng.dirichlet([1.2, 1.2, 1.2], n); prim = rng.integers(0, 3, n); sec = (prim + rng.integers(1, 3, n)) % 3
    recipe = rng.integers(0, 3, (n, 2)); banked = np.zeros(n); waves = np.zeros(n); minhp = np.ones(n); min3 = np.ones(n); in3 = np.zeros(n, bool); took = np.zeros(n); offered = np.zeros(n)
    idx = np.arange(n); bagval = lambda: (bag * need).sum(1) * 3
    for w in range(1, W + 1):
        act = alive & ~done
        if not act.any(): break
        seg = (w - 1) // 4; bossw = w % 4 == 0; hpf = hp / p["hp0"]
        # --- route: two grounds (+ maybe a shrine version of a third) ---
        g1 = rng.integers(0, 3, n); g2 = (g1 + rng.integers(1, 3, n)) % 3; g3 = 3 - g1 - g2
        has_shrine = rng.random(n) < p["shrine_p"]; offered += act & has_shrine
        def match(g):  # ground g's role is weak to weapon (g+1)%3 and strong against weapon (g+2)%3
            m = lambda wt: np.where(wt == (g + 1) % 3, p["adv"], np.where(wt == (g + 2) % 3, -p["dis"], 0.0))
            return 0.6 * m(prim) + 0.4 * m(sec)
        score = lambda g: th[4] * need[idx, g] * 3 + th[5] * match(g) * 4
        s1, s2 = score(g1), score(g2); s3 = score(g3) + th[6] + th[7] * hpf - th[8] * seg
        if force.get("route") == "random": s1, s2, s3 = rng.random(n), rng.random(n), rng.random(n) - 0.2
        if force.get("shrine") == "never": s3 = np.full(n, -1e9)
        if force.get("shrine") == "always": s3 = np.full(n, 1e9)
        s3 = np.where(has_shrine, s3, -1e9)
        pick = np.argmax(np.stack([s1, s2, s3]), 0); ground = np.where(pick == 0, g1, np.where(pick == 1, g2, g3)); shrine = act & (pick == 2)
        took += shrine; maxhp = np.where(shrine, maxhp * (1 - p["shrine_hp"]), maxhp); hp = np.minimum(hp, maxhp)
        # --- wave ---
        bagfrac = np.minimum(bag.sum(1) / p["bag_cap"], 1.5); mt = match(ground)
        threat = p["threat0"] * p["growth"] ** (w - 1) * (1 + heat) * (p["boss"] if bossw else 1.0)
        eff0 = power * sk["m"] * (1 + mt) * (1 - p["bag_slow"] * bagfrac)
        gs = np.clip(th[0] + th[1] * hpf - th[2] * threat / np.maximum(eff0, 1e-9), 0, 1); gl = np.full(n, th[3])
        if "gs" in force: gs = np.full(n, force["gs"])
        if "gl" in force: gl = np.full(n, force["gl"])
        heat_now = heat + p["heat_lull"] * gl
        threat = threat * (1 + heat_now) / (1 + heat)
        eff = eff0 * (1 - sk["tc"] * gs)
        dmg = (np.maximum(threat - eff, 0) * p["dmg"] + p["chip"]) * rng.lognormal(0, sk["noise"], n)
        hp = np.where(act, hp - dmg, hp); died = act & (hp <= 0)
        banked = np.where(died, bagval() * p["keep"] + schem * p["shrine_value"] * p["keep"], banked); alive &= ~died; act &= ~died
        minhp = np.where(act | died, np.minimum(minhp, np.maximum(hp, 0) / p["hp0"]), minhp); waves += act | died
        if seg == 2: min3 = np.where(act | died, np.minimum(min3, np.maximum(hp, 0) / p["hp0"]), min3); in3 |= act | died
        Y = p["y0"] * p["yg"] ** seg * (p["deep_bonus"] if seg == 2 else 1.0)
        add = np.zeros((n, 3)); add[idx, ground] += Y * (p["lull_yield"] * gl + gs); add[idx, prim] += Y * p["kill_yield"]
        bag += add * act[:, None]; schem += shrine & act
        heat = np.where(act, heat_now * p["heat_decay"] + p["heat_swell"] * gs, heat)
        hp = np.where(act, np.minimum(hp + p["regen"], maxhp), hp); power = np.where(act, power + p["auto"], power)
        # --- camp craft (one, discrete) ---
        cost = p["craft_cost"] * p["yg"] ** seg; hpf = hp / p["hp0"]
        for r in (0, 1):
            fam = recipe[:, r]; can = act & (bag[idx, fam] >= cost)
            want = ((hpf < th[9]) | (w / W <= th[10])) & (need[idx, fam] <= th[11])
            if force.get("craft") == "never": want = np.zeros(n, bool)
            if force.get("craft") == "always": want = np.ones(n, bool)
            do = can & want & (crafts < w)          # at most one craft per camp
            bag[idx, fam] -= np.where(do, cost, 0.0)
            power = np.where(do, power * (1 + p["craft_gain"] / (1 + 0.5 * crafts)), power); crafts += do
        if w == 8: power = np.where(act & (crafts >= p["breakout_crafts"]), power * p["breakout"], power)
        if bossw:
            maxhp = np.where(act, p["hp0"], maxhp)
            gate = w // 4
            if gate == 3: out = act
            else:
                out = act & ((hpf < th[12 + 2 * (gate - 1)]) | (bagval() > th[13 + 2 * (gate - 1)] * 100))
                if "depth" in force: out = act & (gate >= force["depth"])
            banked = np.where(out, bagval() + schem * p["shrine_value"], banked); done |= out
    v = banked
    r = dict(value=v.mean(), per_wave=v.sum() / max(waves.sum(), 1), death=1 - alive.mean(), close=(alive & (minhp < 0.25)).mean(),
             easy=(alive & in3 & (min3 > 0.6)).sum() / max(in3.sum(), 1), waves=waves.mean(), shrine_rate=took.sum() / max(offered.sum(), 1), crafts=crafts.mean())
    return r if detail else r["value"]

def search(skill, p, force=None, gens=14, pop=48, elite=10, seed=0):
    rng = np.random.default_rng(seed); mu = (LO + HI) / 2; sd = (HI - LO) / 2.5; best = (-1, mu)
    for g in range(gens):
        X = np.clip(rng.normal(mu, sd, (pop, NP)), LO, HI); X[0] = mu
        f = np.array([simulate(x, skill, p, n=1000, seed=100 + g % 3, force=force) for x in X])
        e = X[np.argsort(-f)[:elite]]; mu = e.mean(0); sd = e.std(0) + 0.03 * (HI - LO) * (1 - g / gens)
    val = np.mean([simulate(mu, skill, p, n=4000, seed=s, force=force) for s in (900, 901)])
    return val, mu

RULES = [dict(gs=g, gl=1.0, route=r, shrine=s, craft=c, depth=d) for g, r, s, c, d in
         itertools.product([0.0, 0.5, 1.0], ["need", "match"], ["never", "always"], ["never", "always"], [1, 2, 3])]
def rule_value(rule, skill, p):
    th = (LO + HI) / 2; th[4], th[5] = (2.0, 0.0) if rule["route"] == "need" else (0.0, 2.0); th[6:9] = 0
    f = dict(gs=rule["gs"], gl=rule["gl"], shrine=rule["shrine"], craft=rule["craft"], depth=rule["depth"])
    return np.mean([simulate(th, skill, p, n=4000, seed=s, force=f) for s in (900, 901)])

LEVERS = {"gathering under fire": [dict(gs=0.0), dict(gs=1.0)], "route (pick at random)": [dict(route="random")],
          "shrine": [dict(shrine="never"), dict(shrine="always")], "camp craft": [dict(craft="never"), dict(craft="always")],
          "depth": [dict(depth=1), dict(depth=3)]}

def evaluate(skill, p, full=True):
    opt, th = search(skill, p); d = simulate(th, skill, p, n=8000, seed=902, detail=True)
    lever = {}
    for name, forces in LEVERS.items():
        lever[name] = [search(skill, p, force=f)[0] / opt for f in forces]
    rules = [rule_value(r, skill, p) for r in RULES]; br = int(np.argmax(rules))
    g1 = simulate(search(skill, p, force=dict(depth=1))[1], skill, p, n=8000, seed=902, force=dict(depth=1), detail=True)
    return dict(opt=opt, th=th, d=d, lever=lever, rule=rules[br] / opt, rule_def=RULES[br], per_wave_gate1=g1["per_wave"], per_wave_opt=d["per_wave"])

def checks(e):
    L = e["lever"]
    return {
        "gathering under fire is worth 10% or more (never gathering loses >=10%)": L["gathering under fire"][0] <= 0.90,
        "flat-out gathering is also bad (loses >=10%)": L["gathering under fire"][1] <= 0.90,
        "route choice is worth 5% or more": L["route (pick at random)"][0] <= 0.95,
        "shrine is a real choice (never AND always both lose >=3%)": max(L["shrine"]) <= 0.97,
        "camp craft is a real choice (never AND always both lose >=3%)": max(L["camp craft"]) <= 0.97,
        "depth is a real choice (always gate 1 AND always gate 3 both lose >=3%)": max(L["depth"]) <= 0.97,
        "no one-sentence rule within 10% of the optimiser": e["rule"] <= 0.90,
        "deep runs pay more per wave than gate-1 farming": e["per_wave_opt"] > e["per_wave_gate1"] * 1.05,
        "best play dies 5-35% of the time": 0.05 <= e["d"]["death"] <= 0.35,
        "the last segment is sometimes easy (breakout): 10% or more of runs that reach it": e["d"]["easy"] >= 0.10,
    }

if __name__ == "__main__":
    t0 = time.time(); res = {}
    for sk in SKILL:
        e = res[sk] = evaluate(sk, BASE); d = e["d"]
        print(f"\n== {sk} ==  optimiser value {e['opt']:.0f} | death {d['death']:.0%} close {d['close']:.0%} easy {d['easy']:.0%} | waves {d['waves']:.1f} | shrine taken {d['shrine_rate']:.0%} of offers | crafts {d['crafts']:.1f}")
        for name, vals in e["lever"].items():
            print(f"   lever {name:24s} forced options keep " + ", ".join(f"{v:.0%}" for v in vals) + " of optimum")
        print(f"   best one-sentence rule keeps {e['rule']:.0%}: {e['rule_def']}")
        print(f"   value per wave: optimiser {e['per_wave_opt']:.1f} vs always-extract-at-gate-1 {e['per_wave_gate1']:.1f}")
        for c, ok in checks(e).items(): print(f"   [{'PASS' if ok else 'FAIL'}] {c}")
    print("\n== lever settings differ by skill? ==")
    for sk in SKILL: print(f"   {sk:8s} theta " + " ".join(f"{x:5.2f}" for x in res[sk]["th"]))
    N = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    print(f"\n== robustness: all {len(BASE)} numeric assumptions shaken +-30%, regular skill, {N} draws ==")
    rng = np.random.default_rng(7); tally = {}
    for i in range(N):
        p = {k: (1 + (v - 1) * rng.uniform(0.7, 1.3) if k in ("growth", "yg", "boss", "breakout", "deep_bonus") else v * rng.uniform(0.7, 1.3)) for k, v in BASE.items()}
        p["breakout_crafts"] = BASE["breakout_crafts"]
        for c, ok in checks(evaluate("regular", p)).items(): tally[c] = tally.get(c, 0) + ok
    for c, k in tally.items(): print(f"   {k:2d}/{N}  {c}")
    print(f"\n[{time.time() - t0:.0f}s]")
